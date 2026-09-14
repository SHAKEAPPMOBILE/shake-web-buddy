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

    const allCandidateIds = [
      ...new Set([...(joinRows ?? []), ...(hostRows ?? [])].map((r) => r.user_id as string)),
    ];

    if (allCandidateIds.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: "no_candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exclude anyone already shown to this user — tapping "Match me up"
    // again should advance through the ranked list, not repeat the same
    // top match every time.
    const { data: alreadyShownRows, error: shownErr } = await supabase
      .from("match_me_up_shown")
      .select("shown_user_id")
      .eq("user_id", userId);

    if (shownErr) console.error("[find-interest-match] match_me_up_shown query error:", shownErr);
    const alreadyShownSet = new Set((alreadyShownRows ?? []).map((r) => r.shown_user_id as string));
    const candidateIds = allCandidateIds.filter((id) => !alreadyShownSet.has(id));

    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: "exhausted" }), {
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

    const myInterestSet = new Set(myInterests);
    let best: { user_id: string; name: string; avatar_url: string | null; shared: string[] } | null = null;

    for (const candidate of candidateProfiles ?? []) {
      const candidateInterests = (candidate.interests as string[] | null) ?? [];
      const shared = candidateInterests.filter((i) => myInterestSet.has(i));
      if (shared.length === 0) continue;
      if (!best || shared.length > best.shared.length) {
        best = {
          user_id: candidate.user_id,
          name: candidate.name || "Someone",
          avatar_url: candidate.avatar_url ?? null,
          shared,
        };
      }
    }

    if (!best) {
      return new Response(JSON.stringify({ matched: false, reason: "no_overlap" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: logErr } = await supabase
      .from("match_me_up_shown")
      .insert({ user_id: userId, shown_user_id: best.user_id });
    if (logErr) console.error("[find-interest-match] match_me_up_shown insert error:", logErr);

    return new Response(
      JSON.stringify({
        matched: true,
        profile: {
          user_id: best.user_id,
          name: best.name,
          avatar_url: best.avatar_url,
          sharedInterests: best.shared,
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
