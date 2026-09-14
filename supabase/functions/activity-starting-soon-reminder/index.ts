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
    // Window: activities starting between (now + 45min) and (now + 60min) —
    // the 15-min bucket a cron firing every 15 minutes needs to land each
    // activity in exactly one tick.
    const windowStart = new Date(now.getTime() + (MINUTES_BEFORE - 15) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + MINUTES_BEFORE * 60 * 1000);

    console.log(`[activity-starting-soon-reminder] Checking window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

    const { data: activities, error: actError } = await supabase
      .from("user_activities")
      .select("id, activity_type, note, venue_name, city, scheduled_for")
      .eq("is_active", true)
      .eq("starting_soon_reminder_sent", false)
      .gte("scheduled_for", windowStart.toISOString())
      .lt("scheduled_for", windowEnd.toISOString());

    if (actError) {
      console.error("[activity-starting-soon-reminder] Query error:", actError);
      return new Response(JSON.stringify({ error: actError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, totalNotified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    let totalNotified = 0;
    const processedIds: string[] = [];

    for (const activity of activities) {
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

    if (processedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("user_activities")
        .update({ starting_soon_reminder_sent: true })
        .in("id", processedIds);

      if (updateError) {
        console.error("[activity-starting-soon-reminder] Failed to mark starting_soon_reminder_sent:", updateError);
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
