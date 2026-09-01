import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Converts a signed-up user's earlier guest joins into real activity_joins
// rows. Scoped to real, user-created plans only (activity_id set) — carousel
// guest joins have no stable row to attach to and aren't auto-claimed here;
// the user just rejoins normally from the app if they want back in.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabase.auth.getUser(token);
    const caller = authData.user;
    if (!caller?.id || !caller.email) {
      return new Response(JSON.stringify({ claimed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pendingJoins } = await supabase
      .from("guest_joins")
      .select("id, activity_id")
      .eq("email", caller.email.trim().toLowerCase())
      .is("claimed_by", null)
      .not("activity_id", "is", null);

    if (!pendingJoins || pendingJoins.length === 0) {
      return new Response(JSON.stringify({ claimed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let claimed = 0;
    for (const join of pendingJoins) {
      // Idempotent — the unique(user_id, activity_type, city) constraint (if
      // any) or a plain duplicate check keeps a double-signup from double-joining.
      const { data: alreadyJoined } = await supabase
        .from("activity_joins")
        .select("id")
        .eq("user_id", caller.id)
        .eq("activity_id", join.activity_id)
        .maybeSingle();

      if (!alreadyJoined) {
        const { data: activity } = await supabase
          .from("user_activities")
          .select("activity_type, city")
          .eq("id", join.activity_id)
          .maybeSingle();
        if (activity) {
          await supabase.from("activity_joins").insert({
            user_id: caller.id,
            activity_id: join.activity_id,
            activity_type: activity.activity_type,
            city: activity.city,
          });
        }
      }

      await supabase
        .from("guest_joins")
        .update({ claimed_by: caller.id, claimed_at: new Date().toISOString() })
        .eq("id", join.id);
      claimed++;
    }

    return new Response(JSON.stringify({ claimed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[claim-guest-joins] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
