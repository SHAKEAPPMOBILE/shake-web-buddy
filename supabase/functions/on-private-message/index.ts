import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
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
      console.warn("[on-private-message] Unauthorized webhook call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json() as WebhookPayload;

    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sender_id, receiver_id, content } = payload.record;

    if (!sender_id || !receiver_id) {
      console.error("[on-private-message] Missing user IDs in record");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Look up sender's display name
    const { data: senderProfile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", sender_id)
      .maybeSingle();

    if (profileError) {
      console.error("[on-private-message] Profile lookup error:", profileError);
    }

    const senderName = senderProfile?.name?.trim() || "Someone";

    // Truncate message preview to 50 characters
    const messageText = (content ?? "").trim();
    const preview = messageText.length > 50
      ? messageText.slice(0, 50) + "…"
      : messageText;

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const pushRes = await fetch(sendPushUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to_user_id: receiver_id,
        title: "New Message 💬",
        body: `${senderName}: ${preview}`,
        data: { tab: "chat" },
      }),
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      console.error("[on-private-message] send-push-notification failed:", pushRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Push delivery failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const pushResult = await pushRes.json();
    console.log("[on-private-message] Push sent:", pushResult);

    return new Response(JSON.stringify({ success: true, push: pushResult }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-private-message] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
