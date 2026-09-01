import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendEmail } from "../_shared/postmark-email-service.ts";

// Minimal label map for the email subject/body — only needs to cover the
// built-in carousel types; anything else falls back to activity_type as-is.
const ACTIVITY_LABELS: Record<string, string> = {
  dinner: "Dinner",
  drinks: "Drinks",
  brunch: "Brunch",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabase.auth.getUser(token);
    const inviter = authData.user;
    if (!inviter?.id) throw new Error("User not authenticated");

    const body = await req.json();
    const activityId: string | undefined = body?.activity_id;
    const rawEmails: string[] = Array.isArray(body?.emails) ? body.emails : [];
    const emails = Array.from(
      new Set(rawEmails.map((e) => (typeof e === "string" ? e.trim().toLowerCase() : "")).filter((e) => e && EMAIL_RE.test(e)))
    );

    if (!activityId || emails.length === 0) {
      return new Response(JSON.stringify({ error: "activity_id and at least one valid email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the plan's creator can invite people to it.
    const { data: activity, error: activityError } = await supabase
      .from("user_activities")
      .select("id, user_id, activity_type, city, scheduled_for, note")
      .eq("id", activityId)
      .maybeSingle();
    if (activityError || !activity) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (activity.user_id !== inviter.id) {
      return new Response(JSON.stringify({ error: "Only the plan's creator can invite people" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", inviter.id)
      .maybeSingle();
    const inviterName = inviterProfile?.name?.trim() || "Someone";

    const planLabel = activity.note?.trim() || ACTIVITY_LABELS[activity.activity_type] || activity.activity_type;
    const inviteUrl = `https://www.shakeapp.today/invite/${activity.id}`;

    const rows = emails.map((email) => ({
      activity_id: activity.id,
      email,
      invited_by: inviter.id,
    }));
    const { error: insertError } = await supabase.from("plan_email_invites").insert(rows);
    if (insertError) {
      console.error("[send-plan-invite] insert error:", insertError);
    }

    const results = await Promise.all(
      emails.map((email) =>
        sendEmail({
          from: "SHAKE <noreply@shakeapp.today>",
          to: email,
          subject: `${inviterName} invited you to ${planLabel} on SHAKE`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 480px; margin: 0 auto; padding: 24px; }
                .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
                .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center; }
                .cta { display: inline-block; margin-top: 16px; background: #111827; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-weight: 600; }
                .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 22px;">🤝 You're invited</h1>
                </div>
                <div class="content">
                  <p style="font-size: 16px; margin: 0 0 4px;"><strong>${inviterName}</strong> invited you to <strong>${planLabel}</strong> in ${activity.city} on SHAKE.</p>
                  <p style="font-size: 14px; color: #6b7280;">Sign up (or log in) and you'll land right on the plan.</p>
                  <a class="cta" href="${inviteUrl}">View the plan</a>
                </div>
                <div class="footer">© 2026 SHAKE. All rights reserved.</div>
              </div>
            </body>
            </html>
          `,
          text: `${inviterName} invited you to ${planLabel} in ${activity.city} on SHAKE. Open ${inviteUrl} to see it — sign up or log in and you'll land right on the plan.`,
        })
      )
    );

    const sentCount = results.filter((r) => r.success).length;
    return new Response(JSON.stringify({ success: true, sent: sentCount, total: emails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-plan-invite] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
