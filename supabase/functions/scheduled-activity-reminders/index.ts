import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Only Dinner (Thursday) and Brunch (Saturday) are offered — Drinks is
// hidden from the app's carousel and never actually joinable, so it gets
// no reminder.
//
// Dinner's reminder fires at 10:30 AM *local time in each city*, not one
// shared UTC instant — pg_cron can't natively do per-timezone schedules, so
// this function is invoked every 15 minutes (see the `dinner-reminder-tick`
// cron job, called with no body) and, on each tick, checks every supported
// city's real local time via Intl — only cities currently at 10:30 Thursday
// local get processed. A city only ever matches one 15-minute tick per day.
//
// Brunch keeps the simpler single-UTC-time model for now (invoked with
// {day:"saturday"} by the unchanged `saturday-reminder` cron at 10:00 UTC) —
// it has the same "lands at a different local time per city" limitation,
// just not fixed yet.
type Day = "saturday";

interface RequestBody {
  day?: Day;
}

interface ActivityConfig {
  activity_type: string;
  message: (city: string) => string;
}

const NOTIFICATION_TYPE = "city_activity_alert";
const WEEKLY_CAP = 2;

const DINNER_CONFIG: ActivityConfig = {
  activity_type: "dinner",
  message: (city) =>
    `🍽️ Dinner in ${city} tonight — the crew is waiting! Join on SHAKE`,
};

const SCHEDULE: Record<Day, ActivityConfig[]> = {
  saturday: [
    {
      activity_type: "brunch",
      message: (city) =>
        `☀️ Brunch in ${city} is on this Saturday! Join the crew on SHAKE`,
    },
  ],
};

// IANA timezone per supported city — keep in sync with src/data/cities.ts.
// Edge Functions can't import from src/, so this is intentionally duplicated.
const CITY_TIMEZONES: Record<string, string> = {
  "New York City": "America/New_York",
  "Los Angeles": "America/Los_Angeles",
  "San Francisco": "America/Los_Angeles",
  "Miami": "America/New_York",
  "Chicago": "America/Chicago",
  "Austin": "America/Chicago",
  "Boston": "America/New_York",
  "Seattle": "America/Los_Angeles",
  "Dallas": "America/Chicago",
  "Washington D.C.": "America/New_York",
  "Toronto": "America/Toronto",
  "Vancouver": "America/Vancouver",
  "Montreal": "America/Toronto",
  "Mexico City": "America/Mexico_City",
  "Guadalajara": "America/Mexico_City",
  "Bogotá": "America/Bogota",
  "Medellín": "America/Bogota",
  "Cartagena": "America/Bogota",
  "Quito": "America/Guayaquil",
  "Lima": "America/Lima",
  "Santiago": "America/Santiago",
  "Valparaíso": "America/Santiago",
  "Buenos Aires": "America/Argentina/Buenos_Aires",
  "Córdoba": "America/Argentina/Cordoba",
  "Montevideo": "America/Montevideo",
  "São Paulo": "America/Sao_Paulo",
  "Rio de Janeiro": "America/Sao_Paulo",
  "Brasília": "America/Sao_Paulo",
  "Salvador": "America/Bahia",
  "Panama City": "America/Panama",
  "London": "Europe/London",
  "Manchester": "Europe/London",
  "Dublin": "Europe/Dublin",
  "Paris": "Europe/Paris",
  "Lyon": "Europe/Paris",
  "Amsterdam": "Europe/Amsterdam",
  "Brussels": "Europe/Brussels",
  "Zurich": "Europe/Zurich",
  "Geneva": "Europe/Zurich",
  "Berlin": "Europe/Berlin",
  "Munich": "Europe/Berlin",
  "Hamburg": "Europe/Berlin",
  "Vienna": "Europe/Vienna",
  "Stockholm": "Europe/Stockholm",
  "Copenhagen": "Europe/Copenhagen",
  "Oslo": "Europe/Oslo",
  "Helsinki": "Europe/Helsinki",
  "Reykjavik": "Atlantic/Reykjavik",
  "Madrid": "Europe/Madrid",
  "Barcelona": "Europe/Madrid",
  "Lisbon": "Europe/Lisbon",
  "Porto": "Europe/Lisbon",
  "Rome": "Europe/Rome",
  "Milan": "Europe/Rome",
  "Florence": "Europe/Rome",
  "Athens": "Europe/Athens",
  "Budapest": "Europe/Budapest",
  "Prague": "Europe/Prague",
  "Warsaw": "Europe/Warsaw",
  "Krakow": "Europe/Warsaw",
  "Bucharest": "Europe/Bucharest",
  "Belgrade": "Europe/Belgrade",
  "Dubrovnik": "Europe/Zagreb",
  "Istanbul": "Europe/Istanbul",
  "Tel Aviv": "Asia/Jerusalem",
  "Jerusalem": "Asia/Jerusalem",
  "Dubai": "Asia/Dubai",
  "Abu Dhabi": "Asia/Dubai",
  "Doha": "Asia/Qatar",
  "Muscat": "Asia/Muscat",
  "Cairo": "Africa/Cairo",
  "Marrakech": "Africa/Casablanca",
  "Casablanca": "Africa/Casablanca",
  "Tunis": "Africa/Tunis",
  "Mumbai": "Asia/Kolkata",
  "New Delhi": "Asia/Kolkata",
  "Bangalore": "Asia/Kolkata",
  "Chennai": "Asia/Kolkata",
  "Colombo": "Asia/Colombo",
  "Dhaka": "Asia/Dhaka",
  "Bangkok": "Asia/Bangkok",
  "Chiang Mai": "Asia/Bangkok",
  "Singapore": "Asia/Singapore",
  "Kuala Lumpur": "Asia/Kuala_Lumpur",
  "Hanoi": "Asia/Ho_Chi_Minh",
  "Ho Chi Minh City": "Asia/Ho_Chi_Minh",
  "Manila": "Asia/Manila",
  "Jakarta": "Asia/Jakarta",
  "Bali": "Asia/Makassar",
  "Tokyo": "Asia/Tokyo",
  "Osaka": "Asia/Tokyo",
  "Kyoto": "Asia/Tokyo",
  "Seoul": "Asia/Seoul",
  "Busan": "Asia/Seoul",
  "Taipei": "Asia/Taipei",
  "Hong Kong": "Asia/Hong_Kong",
  "Beijing": "Asia/Shanghai",
  "Shanghai": "Asia/Shanghai",
  "Sydney": "Australia/Sydney",
  "Cape Town": "Africa/Johannesburg",
};

/** Local weekday/hour/minute for a city right now, via its IANA timezone. */
function getLocalParts(date: Date, timeZone: string): { weekday: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false renders midnight as "24" in some ICU versions — normalise to 0.
  const hour = parseInt(get("hour"), 10) % 24;
  return { weekday: get("weekday"), hour, minute: parseInt(get("minute"), 10) };
}

/** Cities currently at `targetHour`:30–:44 local time on `targetWeekday` (e.g. "Thu"). */
function citiesInLocalWindow(now: Date, targetWeekday: string, targetHour: number): string[] {
  const matches: string[] = [];
  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    const { weekday, hour, minute } = getLocalParts(now, tz);
    if (weekday === targetWeekday && hour === targetHour && minute >= 30 && minute < 45) {
      matches.push(city);
    }
  }
  return matches;
}

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

/** Runs the existing per-city notification logic, scoped to a specific set of cities. */
async function processActivity(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  config: ActivityConfig,
  weekStart: string,
  cutoff48h: string,
  eligibleCities?: string[],
): Promise<{ cities_processed: number; notified: number }> {
  const { activity_type, message } = config;
  const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

  // Find cities where this activity has at least 1 join this week, optionally
  // restricted to a specific set of cities (the local-10:30 tick match).
  let query = supabase
    .from("activity_joins")
    .select("city, user_id")
    .eq("activity_type", activity_type)
    .is("activity_id", null)
    .gte("joined_at", weekStart);

  if (eligibleCities) {
    if (eligibleCities.length === 0) return { cities_processed: 0, notified: 0 };
    query = query.in("city", eligibleCities);
  }

  const { data: cityJoins, error: cityError } = await query;

  if (cityError) {
    console.error(`[scheduled-activity-reminders] City query error for ${activity_type}:`, cityError);
    return { cities_processed: 0, notified: 0 };
  }

  if (!cityJoins || cityJoins.length === 0) {
    return { cities_processed: 0, notified: 0 };
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

  return { cities_processed: cityMap.size, notified: activityNotified };
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
    // Parse body — {day:"saturday"} runs the old fixed-UTC Brunch path;
    // no body (the every-15-min heartbeat) runs the per-timezone Dinner check.
    // ------------------------------------------------------------------
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const day = body?.day?.toLowerCase() as Day | undefined;

    const weekStart = startOfCurrentWeekUTC();
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const summary: { activity_type: string; cities_processed: number; notified: number }[] = [];
    let totalNotified = 0;
    let mode: string;

    if (day) {
      if (!SCHEDULE[day]) {
        return new Response(
          JSON.stringify({ error: "Invalid 'day'. Must be saturday" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      mode = day;
      for (const config of SCHEDULE[day]) {
        const result = await processActivity(supabase, supabaseUrl, serviceRoleKey, config, weekStart, cutoff48h);
        totalNotified += result.notified;
        summary.push({ activity_type: config.activity_type, ...result });
      }
    } else {
      mode = "dinner-tick";
      const now = new Date();
      const eligibleCities = citiesInLocalWindow(now, "Thu", 10); // 10:30 local
      const result = await processActivity(
        supabase, supabaseUrl, serviceRoleKey, DINNER_CONFIG, weekStart, cutoff48h, eligibleCities,
      );
      totalNotified += result.notified;
      summary.push({ activity_type: DINNER_CONFIG.activity_type, ...result });
    }

    console.log(`[scheduled-activity-reminders] mode=${mode} total notified=${totalNotified}`, summary);

    return new Response(JSON.stringify({ success: true, mode, totalNotified, summary }), {
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
