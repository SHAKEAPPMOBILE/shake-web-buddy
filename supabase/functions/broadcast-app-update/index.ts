import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// One-off broadcast to every user with a push token: nudge them to update
// the app, with a dinner teaser folded in. Meant to be fired once (see the
// self-unscheduling `broadcast-app-update-sep19` cron job in the matching
// migration) — NOT a recurring reminder. Logs to notification_log under
// "app_update_broadcast" purely as a record of who got it; nothing reads
// that log back to prevent a resend, since this is intentionally a single
// manual-trigger blast, not a repeating stage.
//
// iOS only, same limitation as every other push in this app — there's no
// FCM/Android push token column or send path yet, so Android users won't
// receive this.

const TITLE = "Update SHAKE 🔄";
const BODY = "A new version of SHAKE is ready — update the app, and join us for dinner in your city tomorrow!";

const CONCURRENCY = 20;

async function sendInBatches(
  userIds: string[],
  send: (uid: string) => Promise<boolean>,
): Promise<{ notified: number; failed: number }> {
  let notified = 0;
  let failed = 0;
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const batch = userIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((uid) => send(uid)));
    for (const ok of results) {
      if (ok) notified++;
      else failed++;
    }
  }
  return { notified, failed };
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      console.warn("[broadcast-app-update] Unauthorized call");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id")
      .not("push_token", "is", null);

    if (profilesErr) {
      console.error("[broadcast-app-update] Profile query error:", profilesErr);
      return new Response(JSON.stringify({ error: "Failed to load recipients" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userIds = (profiles ?? []).map((p) => p.user_id as string);
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const logRows: { user_id: string; notification_type: string }[] = [];

    const { notified, failed } = await sendInBatches(userIds, async (uid) => {
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
        logRows.push({ user_id: uid, notification_type: "app_update_broadcast" });
        return true;
      }
      const errText = await pushRes.text();
      console.error(`[broadcast-app-update] Push failed for ${uid}:`, pushRes.status, errText);
      return false;
    });

    if (logRows.length > 0) {
      const { error: logError } = await supabase.from("notification_log").insert(logRows);
      if (logError) {
        console.error("[broadcast-app-update] notification_log insert error:", logError);
      }
    }

    console.log(`[broadcast-app-update] total=${userIds.length} notified=${notified} failed=${failed}`);

    return new Response(JSON.stringify({ success: true, total: userIds.length, notified, failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[broadcast-app-update] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
