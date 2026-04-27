import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase Database Webhook payload shape
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    created_at: string;
  } | null;
  old_record: null | Record<string, unknown>;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ------------------------------------------------------------------
    // Validate webhook secret — Supabase sends the service role key in
    // Authorization header when the webhook is configured that way
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceRoleKey) {
      console.warn("[on-greeting-created] Unauthorized webhook call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Parse webhook payload
    // ------------------------------------------------------------------
    const payload = await req.json() as WebhookPayload;

    if (payload.type !== "INSERT" || !payload.record) {
      // Nothing to do for updates/deletes
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { from_user_id, to_user_id } = payload.record;

    if (!from_user_id || !to_user_id) {
      console.error("[on-greeting-created] Missing user IDs in record");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Look up the sender's display name
    // ------------------------------------------------------------------
    const { data: fromProfile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", from_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("[on-greeting-created] Profile lookup error:", profileError);
    }

    const fromName = fromProfile?.name?.trim() || "Someone";

    // ------------------------------------------------------------------
    // Call send-push-notification
    // ------------------------------------------------------------------
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const pushRes = await fetch(sendPushUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to_user_id,
        title: "New Invite 🤝",
        body: `${fromName} invited you to meet up!`,
        data: { tab: "home" },
      }),
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      console.error("[on-greeting-created] send-push-notification failed:", pushRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Push delivery failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const pushResult = await pushRes.json();
    console.log("[on-greeting-created] Push sent:", pushResult);

    return new Response(JSON.stringify({ success: true, push: pushResult }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-greeting-created] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
