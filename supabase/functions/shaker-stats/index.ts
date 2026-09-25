import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public, read-only numbers for the marketing site's "N Shakers" pill: the
// same total the app shows (every profile except seeded dicebear test users)
// plus a handful of avatars. Only the app's built-in illustrated avatars are
// returned — never members' own uploaded or Google profile photos — so nothing
// personal leaves the app. No auth: callers are anonymous website visitors.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const APP_ORIGIN = "https://www.shakeapp.today";

function weekSeed(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const week = Math.floor((now.getTime() - Date.UTC(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  return year * 1000 + week * 2 + (now.getUTCDay() >= 3 ? 1 : 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: dice } = await supabase
      .from("profiles").select("*", { count: "exact", head: true }).ilike("avatar_url", "%dicebear%");
    const count = Math.max(0, (total ?? 0) - (dice ?? 0));

    const { data: rows } = await supabase
      .from("profiles").select("avatar_url").ilike("avatar_url", "%/avatars/avatar-new-%").limit(400);
    const presets = Array.from(new Set(
      (rows ?? [])
        .map((r) => (r.avatar_url as string).replace(/^https?:\/\/[^/]+/, ""))
        .filter((p) => /^\/avatars\/avatar-new-\d+\.png$/.test(p)),
    ));

    let seed = weekSeed();
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = presets.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [presets[i], presets[j]] = [presets[j], presets[i]];
    }
    const avatars = presets.slice(0, 7).map((p) => APP_ORIGIN + p);

    return new Response(JSON.stringify({ count, avatars }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  } catch (err) {
    console.error("[shaker-stats]", err);
    return new Response(JSON.stringify({ error: "unavailable" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
