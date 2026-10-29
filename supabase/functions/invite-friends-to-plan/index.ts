import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// One tap from a host: push every accepted friend an invite to the plan. Only friends (people who agreed to
// be connected), only the plan's host, only upcoming plans, and each friend at most once per plan.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_INVITES = 300;

// {{name}} invited you — in the recipient's language.
const TITLES: Record<string, string> = {
  en: "{{name}} invited you 🎉",
  es: "{{name}} te invitó 🎉",
  pt: "{{name}} convidou-te 🎉",
  fr: "{{name}} vous invite 🎉",
  de: "{{name}} hat dich eingeladen 🎉",
  it: "{{name}} ti ha invitato 🎉",
  nl: "{{name}} heeft je uitgenodigd 🎉",
  pl: "{{name}} zaprasza Cię 🎉",
  uk: "{{name}} запрошує тебе 🎉",
  zh: "{{name}} 邀请了你 🎉",
  ja: "{{name}}さんがあなたを招待しました 🎉",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: authData } = await supabase.auth.getUser(token);
    const host = authData.user;
    if (!host?.id) return json({ error: "Unauthorized" }, 401);

    const { activity_id: activityId } = await req.json();
    if (!activityId) return json({ error: "activity_id is required" }, 400);

    const { data: plan } = await supabase
      .from("user_activities")
      .select("id, user_id, note, title, activity_type, scheduled_for, is_active")
      .eq("id", activityId)
      .maybeSingle();
    if (!plan || !plan.is_active) return json({ error: "Plan not found" }, 404);
    if (plan.user_id !== host.id) return json({ error: "Only the host can invite" }, 403);
    if (plan.scheduled_for && new Date(plan.scheduled_for).getTime() < Date.now()) return json({ error: "This plan already happened" }, 400);

    // Accepted friends of the host.
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${host.id},addressee_id.eq.${host.id}`);
    const friendIds = Array.from(new Set((friendships ?? []).map((f) => (f.requester_id === host.id ? f.addressee_id : f.requester_id))));

    // Skip anyone already in the plan or already invited to it.
    const [{ data: attendees }, { data: invited }] = await Promise.all([
      supabase.from("plan_attendees").select("user_id").eq("activity_id", activityId),
      supabase.from("plan_invitations").select("user_id").eq("activity_id", activityId),
    ]);
    const skip = new Set([...(attendees ?? []).map((a) => a.user_id), ...(invited ?? []).map((i) => i.user_id)]);
    const toInvite = friendIds.filter((id) => !skip.has(id)).slice(0, MAX_INVITES);
    if (toInvite.length === 0) return json({ invited: 0, friends: friendIds.length });

    const { error: recordError } = await supabase
      .from("plan_invitations")
      .insert(toInvite.map((user_id) => ({ activity_id: activityId, user_id, invited_by: host.id })));
    if (recordError) {
      console.error("[invite-friends-to-plan] record failed:", recordError);
      return json({ error: "Couldn't send invitations" }, 500);
    }

    const { data: hostProfile } = await supabase.from("profiles").select("name").eq("user_id", host.id).maybeSingle();
    const hostName = hostProfile?.name?.trim() || "A friend";
    const planTitle = plan.note?.trim() || plan.title?.trim() || String(plan.activity_type ?? "plan");
    const { data: langs } = await supabase.from("profiles_private").select("user_id, preferred_language").in("user_id", toInvite);
    const langBy = new Map((langs ?? []).map((l) => [l.user_id, (l.preferred_language ?? "en") as string]));

    await Promise.all(
      toInvite.map(async (userId) => {
        const lang = TITLES[langBy.get(userId) ?? "en"] ? (langBy.get(userId) as string) : "en";
        const when = plan.scheduled_for
          ? new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(plan.scheduled_for))
          : "";
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to_user_id: userId,
            title: TITLES[lang].replace("{{name}}", hostName),
            body: when ? `${planTitle} · ${when}` : planTitle,
            data: { invite_activity_id: String(activityId) },
          }),
        });
        if (!res.ok) console.error("[invite-friends-to-plan] push failed for", userId, res.status);
      }),
    );

    return json({ invited: toInvite.length, friends: friendIds.length });
  } catch (err) {
    console.error("[invite-friends-to-plan] error:", err);
    return json({ error: "Something went wrong" }, 500);
  }
});
