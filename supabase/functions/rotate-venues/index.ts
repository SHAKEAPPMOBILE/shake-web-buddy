/**
 * rotate-venues — Weekly venue rotation Edge Function
 *
 * Calls the `rotate_venues()` DB function to advance is_current to the next
 * venue (by sort_order) for each city + venue_type, skipping any city that
 * already has active joins this week.
 *
 * Intended to be invoked at the start of each week (e.g. Monday 00:00 UTC).
 * NOT currently scheduled — wire up a pg_cron job or Supabase Dashboard cron
 * when ready to go live.
 *
 * Authorization: requires the ROTATE_VENUES_SECRET header to match the
 * ROTATE_VENUES_SECRET env var (set in Supabase Dashboard → Edge Functions).
 * This prevents accidental or unauthorized rotation.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Simple bearer-token auth — set ROTATE_VENUES_SECRET in Edge Function env vars
  const secret = Deno.env.get("ROTATE_VENUES_SECRET");
  if (secret) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("rotate_venues");

  if (error) {
    console.error("[rotate-venues] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[rotate-venues] Rotation complete:", data);
  return new Response(
    JSON.stringify({ ok: true, rotated: data }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
