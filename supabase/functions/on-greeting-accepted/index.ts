import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceRoleKey) {
      console.warn("[on-greeting-accepted] Unauthorized webhook call");
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

    const { from_user_id, to_user_id } = payload.record;

    if (!from_user_id || !to_user_id) {
      console.error("[on-greeting-accepted] Missing user IDs in record");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if a reverse greeting exists (i.e. this is a mutual match)
    const { data: reverseGreeting, error: reverseError } = await supabase
      .from("greetings")
      .select("id")
      .eq("from_user_id", to_user_id)
      .eq("to_user_id", from_user_id)
      .maybeSingle();

    if (reverseError) {
      console.error("[on-greeting-accepted] Reverse greeting lookup error:", reverseError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!reverseGreeting) {
      // No mutual match yet — nothing to do
      console.log("[on-greeting-accepted] No mutual match, skipping push");
      return new Response(JSON.stringify({ skipped: true, reason: "no_match" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mutual match found — look up the accepter's name (from_user_id of the new greeting)
    const { data: accepterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", from_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("[on-greeting-accepted] Profile lookup error:", profileError);
    }

    const accepterName = accepterProfile?.name?.trim() || "Someone";

    // Notify the original sender (to_user_id) that their invite was accepted
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const pushRes = await fetch(sendPushUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to_user_id,
        title: "Invite Accepted! 🎉",
        body: `${accepterName} accepted your invite!`,
        data: { tab: "chat" },
      }),
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      console.error("[on-greeting-accepted] send-push-notification failed:", pushRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Push delivery failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const pushResult = await pushRes.json();
    console.log("[on-greeting-accepted] Push sent:", pushResult);

    return new Response(JSON.stringify({ success: true, push: pushResult }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-greeting-accepted] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
