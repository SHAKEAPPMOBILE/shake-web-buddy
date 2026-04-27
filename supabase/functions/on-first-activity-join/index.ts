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
    joined_at: string;
  } | null;
  old_record: null | Record<string, unknown>;
}

const NOTIFICATION_TYPE = "city_activity_alert";
const WEEKLY_CAP = 2;

/** Returns the ISO timestamp for the most recent Monday 00:00:00 UTC */
function startOfCurrentWeekUTC(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ------------------------------------------------------------------
    // Validate webhook secret
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceRoleKey) {
      console.warn("[on-first-activity-join] Unauthorized webhook call");
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
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { user_id, activity_id, activity_type, city } = payload.record;

    // Only handle carousel joins (activity_id IS NULL)
    if (activity_id !== null && activity_id !== undefined) {
      console.log("[on-first-activity-join] Skipping — not a carousel join");
      return new Response(JSON.stringify({ skipped: true, reason: "not_carousel" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!user_id || !activity_type || !city) {
      console.error("[on-first-activity-join] Missing required fields");
      return new Response(JSON.stringify({ error: "Invalid record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const weekStart = startOfCurrentWeekUTC();

    // ------------------------------------------------------------------
    // Check if this is the FIRST join of the week for city + activity_type
    // ------------------------------------------------------------------
    const { count: joinCount, error: countError } = await supabase
      .from("activity_joins")
      .select("id", { count: "exact", head: true })
      .eq("city", city)
      .eq("activity_type", activity_type)
      .is("activity_id", null)
      .gte("joined_at", weekStart);

    if (countError) {
      console.error("[on-first-activity-join] Join count error:", countError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if ((joinCount ?? 0) !== 1) {
      console.log(`[on-first-activity-join] Not first join this week (count=${joinCount}), skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: "not_first_this_week" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[on-first-activity-join] First ${activity_type} join this week in ${city} — fanning out`);

    // ------------------------------------------------------------------
    // Look up the new joiner's name
    // ------------------------------------------------------------------
    const { data: joinerProfile, error: joinerError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (joinerError) {
      console.error("[on-first-activity-join] Joiner profile error:", joinerError);
    }
    const joinerName = joinerProfile?.name?.trim() || "Someone";

    // ------------------------------------------------------------------
    // Find candidates: users in same city with a push token
    // ------------------------------------------------------------------
    const { data: cityJoiners, error: cityError } = await supabase
      .from("activity_joins")
      .select("user_id")
      .eq("city", city)
      .is("activity_id", null)
      .neq("user_id", user_id);

    if (cityError) {
      console.error("[on-first-activity-join] City joiners error:", cityError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cityJoiners || cityJoiners.length === 0) {
      console.log("[on-first-activity-join] No other users in city");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Deduplicate (a user may have multiple joins for different activity types)
    const candidateIds = [...new Set(cityJoiners.map((j) => j.user_id))];

    // Filter to users who actually have a push token
    const { data: pushProfiles, error: pushError } = await supabase
      .from("profiles")
      .select("user_id")
      .in("user_id", candidateIds)
      .not("push_token", "is", null);

    if (pushError) {
      console.error("[on-first-activity-join] Push profile filter error:", pushError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tokenHolderIds = (pushProfiles ?? []).map((p) => p.user_id);
    if (tokenHolderIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Throttle: exclude users who got this type of alert in the last 48 h
    // ------------------------------------------------------------------
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: recent48h, error: r48Error } = await supabase
      .from("notification_log")
      .select("user_id")
      .eq("notification_type", NOTIFICATION_TYPE)
      .in("user_id", tokenHolderIds)
      .gte("sent_at", cutoff48h);

    if (r48Error) {
      console.error("[on-first-activity-join] 48h throttle query error:", r48Error);
    }
    const throttled48h = new Set((recent48h ?? []).map((r) => r.user_id));

    // ------------------------------------------------------------------
    // Weekly cap: exclude users who already received >= WEEKLY_CAP alerts this week
    // ------------------------------------------------------------------
    const { data: weeklyLogs, error: weeklyError } = await supabase
      .from("notification_log")
      .select("user_id")
      .eq("notification_type", NOTIFICATION_TYPE)
      .in("user_id", tokenHolderIds)
      .gte("sent_at", weekStart);

    if (weeklyError) {
      console.error("[on-first-activity-join] Weekly cap query error:", weeklyError);
    }

    const weeklyCounts = new Map<string, number>();
    for (const row of weeklyLogs ?? []) {
      weeklyCounts.set(row.user_id, (weeklyCounts.get(row.user_id) ?? 0) + 1);
    }

    // ------------------------------------------------------------------
    // Final eligibility filter
    // ------------------------------------------------------------------
    const eligible = tokenHolderIds.filter(
      (uid) => !throttled48h.has(uid) && (weeklyCounts.get(uid) ?? 0) < WEEKLY_CAP,
    );

    if (eligible.length === 0) {
      console.log("[on-first-activity-join] All candidates throttled or capped");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Send pushes and log
    // ------------------------------------------------------------------
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const pushBody = `🔥 ${joinerName} just joined ${activity_type} in ${city} this week — join them on SHAKE!`;
    let notified = 0;
    const logRows: { user_id: string; notification_type: string; city: string; activity_type: string }[] = [];

    for (const uid of eligible) {
      const pushRes = await fetch(sendPushUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to_user_id: uid,
          title: "🔥 First join of the week!",
          body: pushBody,
          data: { tab: "plans" },
        }),
      });

      if (pushRes.ok) {
        notified++;
        logRows.push({ user_id: uid, notification_type: NOTIFICATION_TYPE, city, activity_type });
      } else {
        const errText = await pushRes.text();
        console.error(`[on-first-activity-join] Push failed for ${uid}:`, pushRes.status, errText);
      }
    }

    // Batch-insert notification log rows
    if (logRows.length > 0) {
      const { error: logError } = await supabase.from("notification_log").insert(logRows);
      if (logError) {
        console.error("[on-first-activity-join] notification_log insert error:", logError);
      }
    }

    console.log(`[on-first-activity-join] Notified ${notified}/${eligible.length} users`);

    return new Response(JSON.stringify({ success: true, notified }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[on-first-activity-join] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
