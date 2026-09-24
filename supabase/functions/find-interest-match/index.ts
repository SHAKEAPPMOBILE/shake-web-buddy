import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// "Match me up" carousel item: finds the best same-city match for the
// calling user, ranked by number of shared interests (more overlap = better
// match), excluding anyone already shown to them before (match_me_up_shown)
// so tapping it repeatedly walks through the ranked pool instead of
// repeating the same top match — once everyone's been shown, "exhausted".
// No push notification here — this is a pull (the user opting in by
// tapping the carousel item), not the weekly push version originally
// discussed.
//
// There's no profiles.city column — city is a client-side concept
// (CityContext, GPS/IP + localStorage), never written back to the DB. The
// caller passes their current city; candidates are anyone whose most recent
// activity_joins or user_activities row puts them in that same city — the
// only server-side signal of "which city is this other person in" that
// exists.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json().catch(() => ({})) as { city?: string };
    const city = (body.city ?? "").trim();
    if (!city) {
      return new Response(JSON.stringify({ error: "Missing 'city'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // My own interests
    const { data: myProfile, error: myProfileErr } = await supabase
      .from("profiles")
      .select("interests")
      .eq("user_id", userId)
      .maybeSingle();

    if (myProfileErr) {
      console.error("[find-interest-match] Own profile query error:", myProfileErr);
      return new Response(JSON.stringify({ error: "Failed to load profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const myInterests: string[] = (myProfile?.interests as string[] | null) ?? [];
    if (myInterests.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: "no_interests" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Candidate pool: anyone (other than me) recently active in this city,
    // via either an activity join or a plan they created.
    const [{ data: joinRows, error: joinErr }, { data: hostRows, error: hostErr }] = await Promise.all([
      supabase.from("activity_joins").select("user_id").eq("city", city).neq("user_id", userId),
      supabase.from("user_activities").select("user_id").eq("city", city).neq("user_id", userId),
    ]);

    if (joinErr) console.error("[find-interest-match] activity_joins query error:", joinErr);
    if (hostErr) console.error("[find-interest-match] user_activities query error:", hostErr);

    const sameCityIds = new Set(
      [...(joinRows ?? []), ...(hostRows ?? [])].map((r) => r.user_id as string),
    );

    // Everyone else who has set interests counts too — only a minority of
    // users are recently active in any one city, so restricting to that pool
    // starved the match. Same-city candidates still rank first on ties.
    const { data: interestRows, error: interestErr } = await supabase
      .from("profiles")
      .select("user_id")
      .neq("user_id", userId)
      .not("interests", "is", null)
      .limit(2000);
    if (interestErr) console.error("[find-interest-match] interests pool query error:", interestErr);

    const allCandidateIds = [
      ...new Set([...sameCityIds, ...(interestRows ?? []).map((r) => r.user_id as string)]),
    ];

    if (allCandidateIds.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: "no_candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rotation ────────────────────────────────────────────────────────
    // Per calendar month, per user: shakes 1–2 walk through people already
    // shown who they've never messaged ("old"); the 3rd tries a fresh batch
    // ("new"); if there is nothing new we answer "none", and the shake after
    // a "none" goes back to "old". Anyone the user has messaged is out of the
    // pool for good — that's a real interaction.
    const { data: shownRows, error: shownErr } = await supabase
      .from("match_me_up_shown")
      .select("shown_user_id")
      .eq("user_id", userId);
    if (shownErr) console.error("[find-interest-match] match_me_up_shown query error:", shownErr);
    const shownSet = new Set((shownRows ?? []).map((r) => r.shown_user_id as string));

    const { data: dmRows, error: dmErr } = await supabase
      .from("private_messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .limit(5000);
    if (dmErr) console.error("[find-interest-match] private_messages query error:", dmErr);
    const interactedSet = new Set(
      (dmRows ?? []).map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id) as string),
    );

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: attemptRows, error: attErr } = await supabase
      .from("match_me_up_attempts")
      .select("kind, shown_user_id, created_at")
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    if (attErr) console.error("[find-interest-match] attempts query error:", attErr);
    const recent = (attemptRows ?? []).map((r) => r.kind as string);
    const recentlyShownIds = new Set((attemptRows ?? []).map((r) => r.shown_user_id as string | null).filter(Boolean) as string[]);
    let oldStreak = 0;
    for (const k of recent) { if (k === "old") oldStreak++; else break; }
    const wantNew = recent[0] !== "none" && oldStreak >= 2;

    const candidateIds = allCandidateIds.filter((id) => !interactedSet.has(id));
    if (candidateIds.length === 0) {
      await supabase.from("match_me_up_attempts").insert({ user_id: userId, kind: "none" });
      return new Response(JSON.stringify({ matched: false, reason: "no_candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidateProfiles, error: candErr } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url, interests")
      .in("user_id", candidateIds);

    if (candErr) {
      console.error("[find-interest-match] Candidate profiles query error:", candErr);
      return new Response(JSON.stringify({ error: "Failed to load candidates" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    type Best = { user_id: string; name: string; avatar_url: string | null; shared: string[]; sameCity: boolean };
    const myInterestSet = new Set(myInterests);
    const pickBest = (wantShown: boolean, skip?: Set<string>): Best | null => {
      let best: Best | null = null;
      for (const candidate of candidateProfiles ?? []) {
        if (shownSet.has(candidate.user_id as string) !== wantShown) continue;
        if (skip?.has(candidate.user_id as string)) continue;
        const candidateInterests = (candidate.interests as string[] | null) ?? [];
        const shared = candidateInterests.filter((i) => myInterestSet.has(i));
        if (shared.length === 0) continue;
        const sameCity = sameCityIds.has(candidate.user_id as string);
        if (!best || shared.length > best.shared.length || (shared.length === best.shared.length && sameCity && !best.sameCity)) {
          best = { user_id: candidate.user_id, name: candidate.name || "Someone", avatar_url: candidate.avatar_url ?? null, shared, sameCity };
        }
      }
      return best;
    };

    let best: Best | null = null;
    let kind: "old" | "new" | "none" = "none";
    if (wantNew) {
      best = pickBest(false);
      if (best) kind = "new";
    } else {
      // Never repeat someone already surfaced this month (tapping "Hum!" means
      // "not now"). Only after a "none" answer do we recycle earlier matches.
      best = pickBest(true, recentlyShownIds) ?? (recent[0] === "none" ? pickBest(true) : null);
      if (best) kind = "old";
      else { best = pickBest(false); if (best) kind = "new"; }
    }

    await supabase.from("match_me_up_attempts").insert({ user_id: userId, kind, shown_user_id: best?.user_id ?? null });

    if (!best) {
      return new Response(JSON.stringify({ matched: false, reason: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: logErr } = kind === "new"
      ? await supabase.from("match_me_up_shown").insert({ user_id: userId, shown_user_id: best.user_id })
      : { error: null };
    if (logErr) console.error("[find-interest-match] match_me_up_shown insert error:", logErr);

    return new Response(
      JSON.stringify({
        matched: true,
        profile: {
          user_id: best.user_id,
          name: best.name,
          avatar_url: best.avatar_url,
          sharedInterests: best.shared,
          sameCity: best.sameCity,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[find-interest-match] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
