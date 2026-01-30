import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ACTIVITY-PAYMENT] ${step}${detailsStr}`);
};

// Parse price string like "$5", "5", "€10", "10.50" into cents
function parsePriceToCents(priceStr: string): number | null {
  if (!priceStr) return null;
  
  // Remove currency symbols and whitespace
  const cleaned = priceStr.replace(/[$€£¥₹]/g, '').trim();
  
  // Parse as float
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount) || amount <= 0) return null;
  
  // Convert to cents
  return Math.round(amount * 100);
}

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

    logStep("Processing payment request", { userId: user.id, activityId });

    // Get activity details
    const { data: activity, error: activityError } = await supabaseClient
      .from("user_activities")
      .select("*, user_id, price_amount, note, activity_type, city")
      .eq("id", activityId)
      .eq("is_active", true)
      .maybeSingle();

    if (activityError || !activity) {
      throw new Error("Activity not found");
    }

    if (!activity.price_amount) {
      throw new Error("This activity is free - no payment required");
    }

    const priceInCents = parsePriceToCents(activity.price_amount);
    if (!priceInCents) {
      throw new Error("Invalid price format");
    }

    logStep("Activity found", { 
      activityId, 
      creatorId: activity.user_id, 
      price: activity.price_amount,
      priceInCents 
    });

    // Get creator's Stripe Connect account
    const { data: creatorProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", activity.user_id)
      .maybeSingle();

    if (!creatorProfile?.stripe_account_id || creatorProfile.stripe_account_status !== "complete") {
      throw new Error("Creator has not completed Stripe onboarding");
    }

    logStep("Creator Stripe account found", { stripeAccountId: creatorProfile.stripe_account_id });

    // Get payer's email for Stripe
    const { data: payerPrivate } = await supabaseClient
      .from("profiles_private")
      .select("billing_email")
      .eq("user_id", user.id)
      .maybeSingle();

    const payerEmail = payerPrivate?.billing_email || user.email;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Calculate the 85/15 split
    // Platform fee is 15% of the total
    const platformFee = Math.round(priceInCents * 0.15);
    
    const origin = req.headers.get("origin") || "https://shake-web-buddy.lovable.app";
    
    // Get activity description for checkout
    const activityDescription = activity.note || activity.activity_type;

    // Create Stripe Checkout Session with destination charge
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Join: ${activityDescription}`,
              description: `Activity in ${activity.city}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/?payment_success=true&activity_id=${activityId}`,
      cancel_url: `${origin}/?payment_cancelled=true`,
      customer_email: payerEmail || undefined,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: creatorProfile.stripe_account_id,
        },
        metadata: {
          activity_id: activityId,
          payer_user_id: user.id,
          creator_user_id: activity.user_id,
        },
      },
      metadata: {
        activity_id: activityId,
        payer_user_id: user.id,
      },
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      platformFee,
      creatorAmount: priceInCents - platformFee
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id
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
