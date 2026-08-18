import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/postmark-email-service.ts";

// Supabase Database Webhook payload shape
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: string;
    created_at: string;
  } | null;
  old_record: null | Record<string, unknown>;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceRoleKey) {
      console.warn("[on-friendship-created] Unauthorized webhook call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json() as WebhookPayload;

    // Every row that actually gets inserted is a fresh one-sided request —
    // the friendships trigger auto-accepts (and skips the insert) when the
    // reverse request already exists, so nothing here is ever a mutual match.
    if (payload.type !== "INSERT" || !payload.record || payload.record.status !== "pending") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { requester_id, addressee_id } = payload.record;

    if (!requester_id || !addressee_id) {
      console.error("[on-friendship-created] Missing user IDs in record");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", requester_id)
      .maybeSingle();

    if (profileError) {
      console.error("[on-friendship-created] Profile lookup error:", profileError);
    }

    const requesterName = requesterProfile?.name?.trim() || "Someone";

    // ------------------------------------------------------------------
    // Push notification
    // ------------------------------------------------------------------
    const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to_user_id: addressee_id,
        title: "New friend request 🙌",
        body: `${requesterName} wants to be your friend on SHAKE`,
        data: { tab: "profile" },
      }),
    });

    let pushResult: unknown = null;
    if (!pushRes.ok) {
      console.error("[on-friendship-created] send-push-notification failed:", pushRes.status, await pushRes.text());
    } else {
      pushResult = await pushRes.json();
    }

    // ------------------------------------------------------------------
    // Email notification
    // ------------------------------------------------------------------
    let emailResult: unknown = null;
    const { data: addresseeUser, error: userLookupError } = await supabase.auth.admin.getUserById(addressee_id);
    const addresseeEmail = addresseeUser?.user?.email;

    if (userLookupError) {
      console.error("[on-friendship-created] Addressee lookup error:", userLookupError);
    }

    if (addresseeEmail) {
      emailResult = await sendEmail({
        from: "SHAKE <noreply@shakeapp.today>",
        to: addresseeEmail,
        subject: `${requesterName} wants to be your friend on SHAKE`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 480px; margin: 0 auto; padding: 24px; }
              .header { background: linear-gradient(135deg, #f97316, #a855f7); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center; }
              .cta { display: inline-block; margin-top: 16px; background: #111827; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-weight: 600; }
              .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 22px;">🙌 New friend request</h1>
              </div>
              <div class="content">
                <p style="font-size: 16px; margin: 0 0 4px;"><strong>${requesterName}</strong> wants to be your friend on SHAKE.</p>
                <p style="font-size: 14px; color: #6b7280;">Accept to see their plans in your Friends tab.</p>
                <a class="cta" href="https://www.shakeapp.today">Open SHAKE</a>
              </div>
              <div class="footer">© 2026 SHAKE. All rights reserved.</div>
            </div>
          </body>
          </html>
        `,
        text: `${requesterName} wants to be your friend on SHAKE. Open the app to accept.`,
      });

      if (!emailResult || (emailResult as { success?: boolean }).success !== true) {
        console.error("[on-friendship-created] sendEmail failed:", emailResult);
      }
    } else {
      console.warn("[on-friendship-created] No email on file for addressee", addressee_id);
    }

    return new Response(JSON.stringify({ success: true, push: pushResult, email: emailResult }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-friendship-created] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
