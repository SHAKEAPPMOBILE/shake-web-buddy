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

    // Parse request body for country and reset flag
    let country: string | undefined;
    let reset = false;
    
    try {
      const body = await req.json();
      country = body.country; // ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE")
      reset = body.reset === true;
      logStep("Request body parsed", { country, reset });
    } catch {
      // No body or invalid JSON - that's fine, we'll use defaults
      logStep("No request body or invalid JSON");
    }

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

    // If reset is requested and there's an existing account, delete it from Stripe and clear from DB
    if (reset && accountId) {
      logStep("Reset requested, deleting existing Stripe account", { accountId });
      try {
        await stripe.accounts.del(accountId);
        logStep("Deleted Stripe account successfully");
      } catch (deleteError) {
        // Account might already be deleted or not exist
        logStep("Could not delete Stripe account (may not exist)", { error: String(deleteError) });
      }
      
      // Clear the account ID from the database
      await supabaseClient
        .from("profiles_private")
        .update({ 
          stripe_account_id: null,
          stripe_account_status: null
        })
        .eq("user_id", user.id);
      
      accountId = null;
      logStep("Cleared Stripe account from database");
    }

    if (accountId && !reset) {
      logStep("Found existing Stripe account", { accountId });
      
      // Check account status
      const account = await stripe.accounts.retrieve(accountId);
      
      if (account.charges_enabled && account.payouts_enabled) {
        // Account is fully set up - set as preferred payout method
        await supabaseClient
          .from("profiles_private")
          .update({ 
            stripe_account_status: "complete",
            preferred_payout_method: "stripe"
          })
          .eq("user_id", user.id);
        
        return new Response(JSON.stringify({ 
          status: "complete",
          message: "Your Stripe account is already connected" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }
    
    if (!accountId) {
      // Create a new Stripe Connect account (Express type for easier onboarding)
      // Pass the country if provided
      const accountParams: Stripe.AccountCreateParams = {
        type: "express",
        email: privateProfile?.billing_email || user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          user_id: user.id,
        },
      };

      // Only set country if provided (Stripe requires valid ISO 3166-1 alpha-2 code)
      if (country) {
        accountParams.country = country;
        logStep("Setting account country", { country });
      }

      const account = await stripe.accounts.create(accountParams);

      accountId = account.id;
      logStep("Created new Stripe Connect account", { accountId, country: account.country });

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
