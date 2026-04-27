import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Day = "thursday" | "friday" | "saturday";

interface RequestBody {
  day: Day;
}

interface ActivityConfig {
  activity_type: string;
  message: (city: string) => string;
}

const NOTIFICATION_TYPE = "city_activity_alert";
const WEEKLY_CAP = 2;

const SCHEDULE: Record<Day, ActivityConfig[]> = {
  thursday: [
    {
      activity_type: "drinks",
      message: (city) =>
        `👀 It's almost Friday — Drinks in ${city} is filling up! Join on SHAKE`,
    },
  ],
  friday: [
    {
      activity_type: "drinks",
      message: (city) =>
        `🍹 Tonight's the night — Drinks in ${city} is happening! Don't miss it`,
    },
    {
      activity_type: "dinner",
      message: (city) =>
        `🍽️ Dinner in ${city} tonight — the crew is waiting! Join on SHAKE`,
    },
  ],
  saturday: [
    {
      activity_type: "dinner",
      message: (city) =>
        `🍽️ Last chance for Dinner in ${city} this weekend — join on SHAKE`,
    },
    {
      activity_type: "brunch",
      message: (city) =>
        `☀️ Brunch in ${city} is on this Saturday! Join the crew on SHAKE`,
    },
  ],
};

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
    // Auth: service role key required (cron caller)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceRoleKey) {
      console.warn("[scheduled-activity-reminders] Unauthorized call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Parse body
    // ------------------------------------------------------------------
    const body = await req.json() as RequestBody;
    const day = body?.day?.toLowerCase() as Day | undefined;

    if (!day || !SCHEDULE[day]) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'day'. Must be thursday | friday | saturday" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const weekStart = startOfCurrentWeekUTC();
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const configs = SCHEDULE[day];
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    let totalNotified = 0;
    const summary: { activity_type: string; cities_processed: number; notified: number }[] = [];

    // ------------------------------------------------------------------
    // Process each activity type for this day
    // ------------------------------------------------------------------
    for (const config of configs) {
      const { activity_type, message } = config;

      // Find all cities where this activity has at least 1 join this week
      const { data: cityJoins, error: cityError } = await supabase
        .from("activity_joins")
        .select("city, user_id")
        .eq("activity_type", activity_type)
        .is("activity_id", null)
        .gte("joined_at", weekStart);

      if (cityError) {
        console.error(`[scheduled-activity-reminders] City query error for ${activity_type}:`, cityError);
        continue;
      }

      if (!cityJoins || cityJoins.length === 0) {
        console.log(`[scheduled-activity-reminders] No joins this week for ${activity_type}`);
        summary.push({ activity_type, cities_processed: 0, notified: 0 });
        continue;
      }

      // Group by city and collect who already joined
      const cityMap = new Map<string, Set<string>>();
      for (const row of cityJoins) {
        if (!cityMap.has(row.city)) cityMap.set(row.city, new Set());
        cityMap.get(row.city)!.add(row.user_id);
      }

      let activityNotified = 0;

      for (const [city, alreadyJoinedSet] of cityMap) {
        // Find all carousel users in this city
        const { data: cityUsers, error: cuError } = await supabase
          .from("activity_joins")
          .select("user_id")
          .eq("city", city)
          .is("activity_id", null);

        if (cuError) {
          console.error(`[scheduled-activity-reminders] City users error for ${city}:`, cuError);
          continue;
        }

        // Unique users in the city who have NOT joined this activity yet
        const allCityUserIds = [...new Set((cityUsers ?? []).map((u) => u.user_id))];
        const notYetJoined = allCityUserIds.filter((uid) => !alreadyJoinedSet.has(uid));

        if (notYetJoined.length === 0) continue;

        // Filter to users with push tokens
        const { data: pushProfiles, error: ppError } = await supabase
          .from("profiles")
          .select("user_id")
          .in("user_id", notYetJoined)
          .not("push_token", "is", null);

        if (ppError) {
          console.error(`[scheduled-activity-reminders] Push profile error for ${city}:`, ppError);
          continue;
        }

        const tokenHolderIds = (pushProfiles ?? []).map((p) => p.user_id);
        if (tokenHolderIds.length === 0) continue;

        // Throttle: exclude users who received this alert in last 48h
        const { data: recent48h, error: r48Error } = await supabase
          .from("notification_log")
          .select("user_id")
          .eq("notification_type", NOTIFICATION_TYPE)
          .in("user_id", tokenHolderIds)
          .gte("sent_at", cutoff48h);

        if (r48Error) {
          console.error(`[scheduled-activity-reminders] 48h throttle error:`, r48Error);
        }
        const throttled48h = new Set((recent48h ?? []).map((r) => r.user_id));

        // Weekly cap: exclude users who received >= WEEKLY_CAP alerts this week
        const { data: weeklyLogs, error: wlError } = await supabase
          .from("notification_log")
          .select("user_id")
          .eq("notification_type", NOTIFICATION_TYPE)
          .in("user_id", tokenHolderIds)
          .gte("sent_at", weekStart);

        if (wlError) {
          console.error(`[scheduled-activity-reminders] Weekly cap error:`, wlError);
        }

        const weeklyCounts = new Map<string, number>();
        for (const row of weeklyLogs ?? []) {
          weeklyCounts.set(row.user_id, (weeklyCounts.get(row.user_id) ?? 0) + 1);
        }

        const eligible = tokenHolderIds.filter(
          (uid) => !throttled48h.has(uid) && (weeklyCounts.get(uid) ?? 0) < WEEKLY_CAP,
        );

        if (eligible.length === 0) continue;

        const pushBody = message(city);
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
              title: pushBody.split("—")[0].trim(),
              body: pushBody,
              data: { tab: "plans" },
            }),
          });

          if (pushRes.ok) {
            activityNotified++;
            totalNotified++;
            logRows.push({ user_id: uid, notification_type: NOTIFICATION_TYPE, city, activity_type });
          } else {
            const errText = await pushRes.text();
            console.error(
              `[scheduled-activity-reminders] Push failed for ${uid} (${city}/${activity_type}):`,
              pushRes.status,
              errText,
            );
          }
        }

        if (logRows.length > 0) {
          const { error: logError } = await supabase.from("notification_log").insert(logRows);
          if (logError) {
            console.error("[scheduled-activity-reminders] notification_log insert error:", logError);
          }
        }

        console.log(`[scheduled-activity-reminders] ${city} / ${activity_type}: notified ${logRows.length} users`);
      }

      summary.push({ activity_type, cities_processed: cityMap.size, notified: activityNotified });
    }

    console.log(`[scheduled-activity-reminders] Day=${day} total notified=${totalNotified}`, summary);

    return new Response(JSON.stringify({ success: true, day, totalNotified, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scheduled-activity-reminders] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
