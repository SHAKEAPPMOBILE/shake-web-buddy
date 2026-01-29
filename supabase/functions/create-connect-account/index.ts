import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if user already has a connected account
    const { data: privateProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, stripe_account_status, billing_email")
      .eq("user_id", user.id)
      .maybeSingle();

    let accountId = privateProfile?.stripe_account_id;

    if (accountId) {
      logStep("Found existing Stripe account", { accountId });
      
      // Check account status
      const account = await stripe.accounts.retrieve(accountId);
      
      if (account.charges_enabled && account.payouts_enabled) {
        // Account is fully set up
        await supabaseClient
          .from("profiles_private")
          .update({ stripe_account_status: "complete" })
          .eq("user_id", user.id);
        
        return new Response(JSON.stringify({ 
          status: "complete",
          message: "Your Stripe account is already connected" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } else {
      // Create a new Stripe Connect account (Express type for easier onboarding)
      const account = await stripe.accounts.create({
        type: "express",
        email: privateProfile?.billing_email || user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          user_id: user.id,
        },
      });

      accountId = account.id;
      logStep("Created new Stripe Connect account", { accountId });

      // Save the account ID
      await supabaseClient
        .from("profiles_private")
        .update({ 
          stripe_account_id: accountId,
          stripe_account_status: "pending"
        })
        .eq("user_id", user.id);
    }

    // Create an account link for onboarding
    const origin = req.headers.get("origin") || "https://shake-web-buddy.lovable.app";
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/?connect_refresh=true`,
      return_url: `${origin}/?connect_success=true`,
      type: "account_onboarding",
    });

    logStep("Created account link", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      status: "pending"
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
