import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportNotificationRequest {
  reportedUserId: string;
  reportedUserName: string | null;
  reason: string;
  description: string | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate Content",
  fake_profile: "Fake Profile",
  underage: "Underage User",
  other: "Other",
  block: "User blocked (inappropriate content)",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get reporter's profile
    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { reportedUserId, reportedUserName, reason, description }: ReportNotificationRequest = await req.json();

    // Validate required fields
    if (!reportedUserId || !reason) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reporterName = reporterProfile?.name || "Unknown User";
    const reportedName = reportedUserName || "Unknown User";
    const reasonLabel = REASON_LABELS[reason] || reason;
    const isBlock = reason === "block";
    const reportTime = new Date().toLocaleString("en-US", { 
      timeZone: "Europe/Lisbon",
      dateStyle: "full",
      timeStyle: "short"
    });

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "SHAKE Reports <onboarding@resend.dev>",
      to: ["contact@shakeapp.today"],
      subject: isBlock ? `🚫 User blocked: ${reportedName}` : `🚨 User Report: ${reasonLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 16px; }
            .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
            .value { margin-top: 4px; font-size: 16px; }
            .description { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin-top: 4px; }
            .reason-badge { display: inline-block; background: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 999px; font-weight: 500; }
            .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">🚨 New User Report</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">A user has submitted a report on SHAKE</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Report Reason</div>
                <div class="value"><span class="reason-badge">${reasonLabel}</span></div>
              </div>
              
              <div class="field">
                <div class="label">Reported User</div>
                <div class="value"><strong>${reportedName}</strong></div>
                <div style="font-size: 12px; color: #6b7280;">ID: ${reportedUserId}</div>
              </div>
              
              <div class="field">
                <div class="label">Reported By</div>
                <div class="value">${reporterName}</div>
                <div style="font-size: 12px; color: #6b7280;">ID: ${user.id}</div>
              </div>
              
              ${description ? `
              <div class="field">
                <div class="label">Additional Details</div>
                <div class="description">${description.replace(/\n/g, '<br>')}</div>
              </div>
              ` : ''}
              
              <div class="field">
                <div class="label">Report Time</div>
                <div class="value">${reportTime}</div>
              </div>
              
              <div class="footer">
                <p>This report requires review. Please take appropriate action according to SHAKE Community Guidelines.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Report notification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending report notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
