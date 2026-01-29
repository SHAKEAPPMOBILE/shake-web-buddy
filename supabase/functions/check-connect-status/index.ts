import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-CONNECT-STATUS] ${step}${detailsStr}`);
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

    // Get user's Stripe account ID
    const { data: privateProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!privateProfile?.stripe_account_id) {
      return new Response(JSON.stringify({ 
        connected: false,
        status: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(privateProfile.stripe_account_id);
    
    const isComplete = account.charges_enabled && account.payouts_enabled;
    const newStatus = isComplete ? "complete" : "pending";
    
    // Get email from Stripe account
    const accountEmail = account.email || null;
    
    // Update status if changed, and set as preferred method if newly complete
    if (newStatus !== privateProfile.stripe_account_status) {
      const updateData: Record<string, string> = { stripe_account_status: newStatus };
      
      // Auto-set as preferred method when first becoming complete
      if (newStatus === "complete" && privateProfile.stripe_account_status !== "complete") {
        updateData.preferred_payout_method = "stripe";
      }
      
      await supabaseClient
        .from("profiles_private")
        .update(updateData)
        .eq("user_id", user.id);
    }

    logStep("Account status checked", { 
      accountId: privateProfile.stripe_account_id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      status: newStatus,
      email: accountEmail
    });

    return new Response(JSON.stringify({ 
      connected: true,
      status: newStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      email: accountEmail
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
