import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    activity_id: string | null;
    activity_type: string;
    city: string;
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
      console.warn("[on-activity-joined] Unauthorized webhook call");
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

    const { user_id, activity_id, activity_type, city } = payload.record;

    // Only handle carousel joins (activity_id IS NULL)
    if (activity_id !== null && activity_id !== undefined) {
      console.log("[on-activity-joined] Skipping — not a carousel join (activity_id is set)");
      return new Response(JSON.stringify({ skipped: true, reason: "not_carousel" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!user_id || !activity_type || !city) {
      console.error("[on-activity-joined] Missing required fields in record");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Look up the new joiner's display name
    const { data: joinerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("[on-activity-joined] Profile lookup error:", profileError);
    }

    const joinerName = joinerProfile?.name?.trim() || "Someone";

    // Find other users who joined the same activity_type + city (carousel joins only)
    const { data: otherJoins, error: joinsError } = await supabase
      .from("activity_joins")
      .select("user_id")
      .eq("activity_type", activity_type)
      .eq("city", city)
      .is("activity_id", null)
      .neq("user_id", user_id);

    if (joinsError) {
      console.error("[on-activity-joined] Other joins lookup error:", joinsError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!otherJoins || otherJoins.length === 0) {
      console.log("[on-activity-joined] No other users to notify");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const results: unknown[] = [];

    for (const join of otherJoins) {
      const pushRes = await fetch(sendPushUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to_user_id: join.user_id,
          title: "New Shaker joined! 👥",
          body: `${joinerName} joined ${activity_type} in ${city}`,
          data: { tab: "plans" },
        }),
      });

      if (!pushRes.ok) {
        const errText = await pushRes.text();
        console.error(`[on-activity-joined] Push failed for user ${join.user_id}:`, pushRes.status, errText);
      } else {
        const pushResult = await pushRes.json();
        results.push(pushResult);
      }
    }

    console.log(`[on-activity-joined] Notified ${results.length} users`);

    return new Response(JSON.stringify({ success: true, notified: results.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-activity-joined] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
