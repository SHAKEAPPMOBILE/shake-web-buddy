import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Only send feedback notifications for these activity types
const FEEDBACK_ACTIVITIES = ["dinner", "brunch"];

// Minutes after scheduled_for to send the feedback push
const DELAY_MINUTES = 30;

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: service role key required (cron caller)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      console.warn("[post-activity-feedback] Unauthorized call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    // Window: activities that started between (now - DELAY_MINUTES - 15) and (now - DELAY_MINUTES)
    // The 15-min window accounts for cron firing every 15 minutes — we capture exactly one window.
    const windowEnd = new Date(now.getTime() - DELAY_MINUTES * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - 15 * 60 * 1000);

    console.log(`[post-activity-feedback] Checking window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

    // Find all eligible activity instances that need feedback sent
    const { data: activities, error: actError } = await supabase
      .from("user_activities")
      .select("id, activity_type, city, scheduled_for")
      .in("activity_type", FEEDBACK_ACTIVITIES)
      .eq("is_active", true)
      .eq("feedback_sent", false)
      .gte("scheduled_for", windowStart.toISOString())
      .lte("scheduled_for", windowEnd.toISOString());

    if (actError) {
      console.error("[post-activity-feedback] Query error:", actError);
      return new Response(JSON.stringify({ error: actError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!activities || activities.length === 0) {
      console.log("[post-activity-feedback] No activities to process");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    let totalNotified = 0;
    const processedIds: string[] = [];

    for (const activity of activities) {
      console.log(`[post-activity-feedback] Processing activity ${activity.id} (${activity.activity_type} in ${activity.city})`);

      // Find all participants who joined this specific activity
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id);

      if (joinsError) {
        console.error(`[post-activity-feedback] Joins query error for ${activity.id}:`, joinsError);
        continue;
      }

      if (!joins || joins.length === 0) {
        console.log(`[post-activity-feedback] No participants for activity ${activity.id}, marking feedback_sent`);
        processedIds.push(activity.id);
        continue;
      }

      const participantIds = [...new Set(joins.map((j) => j.user_id))];

      // Fetch push tokens for participants
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, push_token")
        .in("user_id", participantIds)
        .not("push_token", "is", null);

      if (profilesError) {
        console.error(`[post-activity-feedback] Profiles query error:`, profilesError);
        continue;
      }

      const activityLabel = activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1);
      const title = `How was ${activityLabel}? 🌟`;
      const body = `Hope you had a great time! Tap to rate your experience and help others find the best crew.`;

      let activityNotified = 0;

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
            data: { action: "rate_app" },
          }),
        });

        if (pushRes.ok) {
          activityNotified++;
          totalNotified++;
          console.log(`[post-activity-feedback] Push sent to ${profile.user_id}`);
        } else {
          const errText = await pushRes.text();
          console.error(
            `[post-activity-feedback] Push failed for ${profile.user_id}:`,
            pushRes.status,
            errText,
          );
        }
      }

      processedIds.push(activity.id);
      console.log(`[post-activity-feedback] Activity ${activity.id}: notified ${activityNotified}/${participantIds.length} participants`);
    }

    // Mark all processed activities as feedback_sent = true
    if (processedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("user_activities")
        .update({ feedback_sent: true })
        .in("id", processedIds);

      if (updateError) {
        console.error("[post-activity-feedback] Failed to mark feedback_sent:", updateError);
      } else {
        console.log(`[post-activity-feedback] Marked ${processedIds.length} activities as feedback_sent`);
      }
    }

    console.log(`[post-activity-feedback] Done. Total notified: ${totalNotified}`);

    return new Response(
      JSON.stringify({ success: true, processed: processedIds.length, totalNotified }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[post-activity-feedback] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
