import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const ACTIVITY_LABELS: Record<string, string> = {
  dinner: "Dinner",
  drinks: "Drinks",
  brunch: "Brunch",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const token: string | undefined = body?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: guestJoin, error } = await supabase
      .from("guest_joins")
      .select("activity_id, activity_type, city, scheduled_for, name, email")
      .eq("token", token)
      .maybeSingle();
    if (error || !guestJoin) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let planLabel = ACTIVITY_LABELS[guestJoin.activity_type] || guestJoin.activity_type;
    let note: string | null = null;
    let creatorName: string | null = null;
    let creatorAvatar: string | null = null;
    let promoVideoUrl: string | null = null;
    let promoImageUrl: string | null = null;
    let description: string | null = null;
    let venueName: string | null = null;
    let participantCount = 0;

    if (guestJoin.activity_id) {
      const { data: activity } = await supabase
        .from("user_activities")
        .select("note, user_id, promo_video_url, promo_image_url, description, venue_name")
        .eq("id", guestJoin.activity_id)
        .maybeSingle();
      if (activity) {
        if (activity.note?.trim()) planLabel = activity.note.trim();
        note = activity.note;
        promoVideoUrl = activity.promo_video_url;
        promoImageUrl = activity.promo_image_url;
        description = activity.description;
        venueName = activity.venue_name;
        if (activity.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("user_id", activity.user_id)
            .maybeSingle();
          creatorName = profile?.name ?? null;
          creatorAvatar = profile?.avatar_url ?? null;
        }
      }
      const { count: realCount } = await supabase
        .from("activity_joins")
        .select("id", { count: "exact", head: true })
        .eq("activity_id", guestJoin.activity_id);
      const { count: guestCount } = await supabase
        .from("guest_joins")
        .select("id", { count: "exact", head: true })
        .eq("activity_id", guestJoin.activity_id);
      participantCount = (realCount ?? 0) + (guestCount ?? 0);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: {
          activity_id: guestJoin.activity_id,
          activity_type: guestJoin.activity_type,
          city: guestJoin.city,
          scheduled_for: guestJoin.scheduled_for,
          note,
          plan_label: planLabel,
          creator_name: creatorName,
          creator_avatar: creatorAvatar,
          promo_video_url: promoVideoUrl,
          promo_image_url: promoImageUrl,
          description,
          venue_name: venueName,
          participant_count: participantCount,
          guest_name: guestJoin.name,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[get-guest-join] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
