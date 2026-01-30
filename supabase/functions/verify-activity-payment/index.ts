import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-ACTIVITY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const body = await req.json();
    const { activityId } = body;

    if (!activityId) {
      throw new Error("Activity ID is required");
    }

    logStep("Verifying payment", { userId: user.id, activityId });

    // Check if user has already joined this activity
    const { data: existingJoin } = await supabaseClient
      .from("activity_joins")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingJoin) {
      logStep("User already joined activity", { joinId: existingJoin.id });
      return new Response(JSON.stringify({ 
        success: true, 
        alreadyJoined: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get activity details
    const { data: activity, error: activityError } = await supabaseClient
      .from("user_activities")
      .select("activity_type, city, price_amount, user_id")
      .eq("id", activityId)
      .eq("is_active", true)
      .maybeSingle();

    if (activityError || !activity) {
      throw new Error("Activity not found");
    }

    // If free activity, no payment needed
    if (!activity.price_amount) {
      logStep("Free activity - joining directly");
      
      const { error: joinError } = await supabaseClient
        .from("activity_joins")
        .insert({
          user_id: user.id,
          activity_id: activityId,
          activity_type: activity.activity_type,
          city: activity.city,
        });

      if (joinError) {
        throw new Error(`Failed to join activity: ${joinError.message}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For paid activity, verify payment with Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Search for completed checkout sessions for this activity/user
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
    });

    // Find a completed session matching this activity and user
    const completedSession = sessions.data.find((session: Stripe.Checkout.Session) => 
      session.metadata?.activity_id === activityId &&
      session.metadata?.payer_user_id === user.id &&
      session.payment_status === "paid"
    );

    if (!completedSession) {
      logStep("No completed payment found", { activityId, userId: user.id });
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Payment not found or not completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Payment verified", { sessionId: completedSession.id });

    // Create activity join
    const { error: joinError } = await supabaseClient
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_id: activityId,
        activity_type: activity.activity_type,
        city: activity.city,
      });

    if (joinError) {
      // Check if it's a duplicate (race condition with webhook)
      if (joinError.code === '23505') {
        logStep("Join already exists (race condition)", { activityId, userId: user.id });
        return new Response(JSON.stringify({ 
          success: true, 
          alreadyJoined: true 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw new Error(`Failed to join activity: ${joinError.message}`);
    }

    logStep("User joined activity after payment verification", { activityId, userId: user.id });

    return new Response(JSON.stringify({ 
      success: true,
      activityType: activity.activity_type,
      city: activity.city,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
