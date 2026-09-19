import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// "Starts in 1 hour" reminder for everyone who already joined an activity —
// covers real proposed plans (e.g. "skate at the park") and auto-generated
// dinner/brunch instances alike, since both are real user_activities rows
// with a real scheduled_for. Doesn't cover the simpler carousel joins that
// have no activity_id (activity_joins.activity_id IS NULL) — those aren't
// tied to one specific dated row, so there's nothing to count down to here.
//
// Same window-bucketing pattern as post-activity-feedback, just looking
// forward instead of back: invoked every 15 minutes by the
// activity-starting-soon-tick cron job.
const MINUTES_BEFORE = 60;

// Auto-generated (carousel) plans carry a synthetic NOON scheduled_for —
// it only encodes which day the plan is for, never a real time of day (see
// the identical comment on ACTIVITY_START_TIMES in src/data/activityTypes.ts,
// and getActivityTimeString there, which the frontend uses to never format
// that noon value as a real time). This reminder used to treat scheduled_for
// as the literal start time, which for brunch — real start 11:00, placeholder
// 12:00 — fired the "starts in 1 hour" push exactly AT the real 11:00 start
// instead of an hour before it. These are the same corrections in hours
// relative to that placeholder noon, one per auto-generated activity type;
// anything not listed here (or not auto-generated) needs no correction.
const AUTO_GENERATED_HOUR_OFFSET_FROM_NOON: Record<string, number> = {
  brunch: -1, // 11:00 AM
  dinner: 7,  // 7:00 PM
  drinks: 8,  // 8:00 PM
};
const MIN_OFFSET_HOURS = Math.min(0, ...Object.values(AUTO_GENERATED_HOUR_OFFSET_FROM_NOON));
const MAX_OFFSET_HOURS = Math.max(0, ...Object.values(AUTO_GENERATED_HOUR_OFFSET_FROM_NOON));

function realStartTime(activity: { activity_type: string; is_auto_generated: boolean | null; scheduled_for: string }): Date {
  const raw = new Date(activity.scheduled_for);
  if (!activity.is_auto_generated) return raw;
  const offsetHours = AUTO_GENERATED_HOUR_OFFSET_FROM_NOON[activity.activity_type];
  if (offsetHours === undefined) return raw;
  return new Date(raw.getTime() + offsetHours * 60 * 60 * 1000);
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      console.warn("[activity-starting-soon-reminder] Unauthorized call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    // The true 45-60min-from-now window we're looking for, by real start time.
    const windowStart = new Date(now.getTime() + (MINUTES_BEFORE - 15) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + MINUTES_BEFORE * 60 * 1000);

    // The raw scheduled_for query has to be widened by the auto-generated
    // correction range so a row whose real start lands in the window above
    // isn't missed just because its stored (placeholder, for auto-generated
    // rows) timestamp doesn't. Filtered precisely by real start time below.
    const rawQueryStart = new Date(windowStart.getTime() - MAX_OFFSET_HOURS * 60 * 60 * 1000);
    const rawQueryEnd = new Date(windowEnd.getTime() - MIN_OFFSET_HOURS * 60 * 60 * 1000);

    console.log(`[activity-starting-soon-reminder] Real-start window ${windowStart.toISOString()} → ${windowEnd.toISOString()}, raw query ${rawQueryStart.toISOString()} → ${rawQueryEnd.toISOString()}`);

    const { data: candidates, error: actError } = await supabase
      .from("user_activities")
      .select("id, activity_type, note, venue_name, city, scheduled_for, is_auto_generated")
      .eq("is_active", true)
      .eq("starting_soon_reminder_sent", false)
      .gte("scheduled_for", rawQueryStart.toISOString())
      .lt("scheduled_for", rawQueryEnd.toISOString());

    if (actError) {
      console.error("[activity-starting-soon-reminder] Query error:", actError);
      return new Response(JSON.stringify({ error: actError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const activities = (candidates ?? []).filter((a) => {
      const start = realStartTime(a);
      return start >= windowStart && start < windowEnd;
    });

    if (activities.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, totalNotified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    let totalNotified = 0;
    const processedIds: string[] = [];

    for (const activity of activities) {
      // Atomically claim this activity before sending anything — if the
      // conditional update affects no row, some other invocation (a retried
      // or overlapping cron tick) already claimed it, so this one backs off
      // instead of sending a duplicate "starts in 1 hour" push.
      const { data: claimed, error: claimError } = await supabase
        .from("user_activities")
        .update({ starting_soon_reminder_sent: true })
        .eq("id", activity.id)
        .eq("starting_soon_reminder_sent", false)
        .select("id");

      if (claimError) {
        console.error(`[activity-starting-soon-reminder] Claim error for ${activity.id}:`, claimError);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        console.log(`[activity-starting-soon-reminder] ${activity.id} already claimed by another tick, skipping`);
        continue;
      }

      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id);

      if (joinsError) {
        console.error(`[activity-starting-soon-reminder] Joins query error for ${activity.id}:`, joinsError);
        continue;
      }

      processedIds.push(activity.id);
      const participantIds = [...new Set((joins ?? []).map((j) => j.user_id))];
      if (participantIds.length === 0) continue;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, push_token")
        .in("user_id", participantIds)
        .not("push_token", "is", null);

      if (profilesError) {
        console.error(`[activity-starting-soon-reminder] Profiles query error:`, profilesError);
        continue;
      }

      const label = activity.note
        || activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1);
      const title = `⏰ ${label} starts in 1 hour!`;
      const body = activity.venue_name
        ? `${label} at ${activity.venue_name} starts soon — see you there!`
        : `${label} in ${activity.city} starts soon — see you there!`;

      for (const profile of profiles ?? []) {
        const pushRes = await fetch(sendPushUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to_user_id: profile.user_id,
            title,
            body,
            data: { tab: "plans" },
          }),
        });

        if (pushRes.ok) {
          totalNotified++;
        } else {
          const errText = await pushRes.text();
          console.error(`[activity-starting-soon-reminder] Push failed for ${profile.user_id}:`, pushRes.status, errText);
        }
      }
    }

    console.log(`[activity-starting-soon-reminder] Done. Processed ${processedIds.length}, notified ${totalNotified}`);

    return new Response(
      JSON.stringify({ success: true, processed: processedIds.length, totalNotified }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[activity-starting-soon-reminder] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
