import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Nudges users toward proposing a plan at three points in their tenure, then
// stops for good:
//   - day 5 after signup   ("create_plan_nudge_day5")
//   - month 3 after signup ("create_plan_nudge_month3")
//   - month 6 after signup ("create_plan_nudge_month6", i.e. 3 months after
//     the month-3 nudge)
// Each stage fires at most once per user ever — tracked in notification_log,
// keyed by these notification_type values. Invoked once a day by the
// `create-plan-nudge-daily` cron job (see migration), no request body.
//
// profiles has no dedicated "installed_at" column, so profiles.created_at
// (the signup row's creation time) is used as the tenure anchor.
//
// Someone who already creates plans doesn't need "take the initiative" —
// skip anyone who has proposed a real (non-auto-generated) plan in the last
// 60 days, so this doesn't nag already-active hosts.

const STAGES: { type: string; windowStartDays: number; windowEndDays: number }[] = [
  { type: "create_plan_nudge_day5", windowStartDays: 6, windowEndDays: 5 },
  { type: "create_plan_nudge_month3", windowStartDays: 91, windowEndDays: 90 },
  { type: "create_plan_nudge_month6", windowStartDays: 181, windowEndDays: 180 },
];

const TITLE = "Take the initiative 🎉";
const BODY = "Take initiative — create a plan on SHAKE so others can join!";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      console.warn("[create-plan-nudge] Unauthorized call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const now = Date.now();
    const summary: { stage: string; eligible: number; notified: number }[] = [];

    for (const stage of STAGES) {
      const windowStart = new Date(now - stage.windowStartDays * 86400000).toISOString();
      const windowEnd = new Date(now - stage.windowEndDays * 86400000).toISOString();

      const { data: candidates, error: candErr } = await supabase
        .from("profiles")
        .select("user_id")
        .not("push_token", "is", null)
        .gte("created_at", windowStart)
        .lt("created_at", windowEnd);

      if (candErr) {
        console.error(`[create-plan-nudge] ${stage.type} candidate query error:`, candErr);
        continue;
      }

      const candidateIds = (candidates ?? []).map((c) => c.user_id as string);
      if (candidateIds.length === 0) {
        summary.push({ stage: stage.type, eligible: 0, notified: 0 });
        continue;
      }

      // Already got this exact stage before (should be impossible given the
      // tight date window + daily cron, but a re-run/overlap must never
      // double-send).
      const { data: alreadySent, error: alreadyErr } = await supabase
        .from("notification_log")
        .select("user_id")
        .eq("notification_type", stage.type)
        .in("user_id", candidateIds);

      if (alreadyErr) {
        console.error(`[create-plan-nudge] ${stage.type} dedupe query error:`, alreadyErr);
      }
      const alreadySentSet = new Set((alreadySent ?? []).map((r) => r.user_id));

      // Already an active host — creating a real plan in the last 60 days.
      const cutoff60d = new Date(now - 60 * 86400000).toISOString();
      const { data: recentHosts, error: hostsErr } = await supabase
        .from("user_activities")
        .select("user_id")
        .in("user_id", candidateIds)
        .eq("is_auto_generated", false)
        .gte("created_at", cutoff60d);

      if (hostsErr) {
        console.error(`[create-plan-nudge] ${stage.type} recent-hosts query error:`, hostsErr);
      }
      const recentHostSet = new Set((recentHosts ?? []).map((r) => r.user_id));

      const eligible = candidateIds.filter(
        (uid) => !alreadySentSet.has(uid) && !recentHostSet.has(uid),
      );

      let notified = 0;
      const logRows: { user_id: string; notification_type: string }[] = [];

      for (const uid of eligible) {
        const pushRes = await fetch(sendPushUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to_user_id: uid,
            title: TITLE,
            body: BODY,
            data: { tab: "home" },
          }),
        });

        if (pushRes.ok) {
          notified++;
          logRows.push({ user_id: uid, notification_type: stage.type });
        } else {
          const errText = await pushRes.text();
          console.error(`[create-plan-nudge] Push failed for ${uid} (${stage.type}):`, pushRes.status, errText);
        }
      }

      if (logRows.length > 0) {
        const { error: logError } = await supabase.from("notification_log").insert(logRows);
        if (logError) {
          console.error(`[create-plan-nudge] notification_log insert error (${stage.type}):`, logError);
        }
      }

      console.log(`[create-plan-nudge] ${stage.type}: eligible=${eligible.length} notified=${notified}`);
      summary.push({ stage: stage.type, eligible: eligible.length, notified });
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-plan-nudge] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
