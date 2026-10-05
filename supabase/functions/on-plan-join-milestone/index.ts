import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fired by a DB trigger on activity_joins AFTER INSERT (see migration
// 20260909130000_plan_join_milestone_trigger.sql), for joins to a specific
// plan (activity_id IS NOT NULL) — as opposed to on-activity-joined /
// on-first-activity-join, which only handle carousel joins (activity_id
// IS NULL).
//
// get_user_points() awards a plan's creator +5 points per every 5 attendees
// (FLOOR(participant_count / 5) * 5). That's a live SQL calculation with no
// discrete "award" event of its own — this function is what turns "someone
// just joined" into "did the creator's count just cross a multiple of 5?"
// so they can get a push notification the moment it actually happens.

// Translations of this push (kept in step with points.pushPopularTitle / pushPopularBody in the app's locale files).
const POPULAR_PUSH: Record<string, { title: string; body: string }> = {
  en: { title: "🎉 Your plan is popular!", body: "+5 points — your plan now has {{count}} people joining." },
  es: { title: "🎉 ¡Tu plan es popular!", body: "+5 puntos: tu plan ya tiene {{count}} personas apuntadas." },
  pt: { title: "🎉 Seu plano está bombando!", body: "+5 pontos: seu plano já tem {{count}} pessoas participando." },
  fr: { title: "🎉 Votre plan fait un carton !", body: "+5 points : votre plan compte déjà {{count}} participants." },
  de: { title: "🎉 Dein Plan ist beliebt!", body: "+5 Punkte – bei deinem Plan machen schon {{count}} Leute mit." },
  it: { title: "🎉 Il tuo piano è popolare!", body: "+5 punti: al tuo piano partecipano già {{count}} persone." },
  nl: { title: "🎉 Je plan is populair!", body: "+5 punten – er doen al {{count}} mensen mee aan je plan." },
  pl: { title: "🎉 Twój plan jest popularny!", body: "+5 punktów – w twoim planie bierze już udział {{count}} osób." },
  uk: { title: "🎉 Ваш план популярний!", body: "+5 балів — у вашому плані вже бере участь {{count}} осіб." },
  zh: { title: "🎉 你的活动很受欢迎！", body: "+5 积分——你的活动已有 {{count}} 人参加。" },
  ja: { title: "🎉 あなたのプランが人気です！", body: "+5ポイント — プランの参加者が{{count}}人になりました。" },
};

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

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // The function gateway (verify_jwt=true, matching the other
    // activity_joins webhooks) requires a syntactically valid Supabase JWT
    // in Authorization — an arbitrary shared secret fails gateway-side
    // before this code even runs. This project's auto-injected
    // SUPABASE_SERVICE_ROLE_KEY env var is the newer opaque sb_secret_
    // format (not a JWT), so it can't be the thing a JWT-shaped caller is
    // compared against. TRIGGER_AUTH_JWT holds the project's legacy
    // service_role JWT explicitly for that purpose instead.
    const triggerAuthJwt = Deno.env.get("TRIGGER_AUTH_JWT")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (!triggerAuthJwt || token !== triggerAuthJwt) {
      console.warn("[on-plan-join-milestone] Unauthorized webhook call");
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

    const { activity_id, user_id: joinerUserId } = payload.record;

    // Only plan-specific joins earn the creator popularity bonus.
    if (!activity_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_plan_join" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: activity, error: activityError } = await supabase
      .from("user_activities")
      .select("user_id")
      .eq("id", activity_id)
      .maybeSingle();

    if (activityError) {
      console.error("[on-plan-join-milestone] Activity lookup error:", activityError);
      return new Response(JSON.stringify({ error: "Activity lookup failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auto-generated carousel activities have no user_activities row —
    // nothing to award here.
    if (!activity?.user_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_creator" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const creatorUserId = activity.user_id;

    // Creator joining/re-counted on their own plan isn't a new attendee.
    if (creatorUserId === joinerUserId) {
      return new Response(JSON.stringify({ skipped: true, reason: "self_join" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { count: participantCount, error: countError } = await supabase
      .from("activity_joins")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activity_id);

    if (countError) {
      console.error("[on-plan-join-milestone] Count error:", countError);
      return new Response(JSON.stringify({ error: "Count failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const count = participantCount ?? 0;

    // Only fire exactly when this join is what pushed the count over a
    // multiple of 5 — not on every join afterwards.
    if (count === 0 || count % 5 !== 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_a_milestone", count }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Write the push in the creator's own language (English if they haven't set one).
    const { data: langRow } = await supabase
      .from("profiles_private")
      .select("preferred_language")
      .eq("user_id", creatorUserId)
      .maybeSingle();
    const langCode = (langRow?.preferred_language ?? "en").split("-")[0].toLowerCase();
    const copy = POPULAR_PUSH[langCode] ?? POPULAR_PUSH.en;

    const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
      body: {
        to_user_id: creatorUserId,
        title: copy.title,
        body: copy.body.replace("{{count}}", String(count)),
      },
    });

    if (pushError) {
      console.error("[on-plan-join-milestone] Push notification error:", pushError);
    }

    return new Response(JSON.stringify({ notified: true, count }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[on-plan-join-milestone] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
