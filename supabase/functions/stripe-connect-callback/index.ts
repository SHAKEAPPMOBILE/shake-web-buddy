import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-CALLBACK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Callback received");

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Parse state to get user ID and origin
    let userId: string;
    let origin: string;
    
    try {
      const stateData = JSON.parse(atob(state || ""));
      userId = stateData.userId;
      origin = stateData.origin || "https://shake-web-buddy.lovable.app";
      logStep("Parsed state", { userId, origin });
    } catch {
      logStep("Failed to parse state, using defaults");
      origin = "https://shake-web-buddy.lovable.app";
      
      // Redirect with error if we can't parse state
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/?connect_error=invalid_state`,
        },
      });
    }

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      logStep("OAuth error", { error, errorDescription });
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/?connect_error=${encodeURIComponent(error)}`,
        },
      });
    }

    if (!code) {
      logStep("No authorization code received");
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/?connect_error=no_code`,
        },
      });
    }

    logStep("Authorization code received", { codePrefix: code.substring(0, 10) + "..." });

    // Exchange code for Stripe account ID
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code: code,
    });

    const connectedAccountId = response.stripe_user_id;
    logStep("OAuth token exchange successful", { accountId: connectedAccountId });

    if (!connectedAccountId) {
      throw new Error("No account ID returned from Stripe");
    }

    // Retrieve account details to get email
    const account = await stripe.accounts.retrieve(connectedAccountId);
    logStep("Retrieved account details", { 
      accountId: connectedAccountId,
      email: account.email,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled
    });

    // Determine account status based on capabilities
    const accountStatus = (account.charges_enabled && account.payouts_enabled) 
      ? "complete" 
      : "pending";

    // Save the connected account to the database
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error: updateError } = await supabaseClient
      .from("profiles_private")
      .update({ 
        stripe_account_id: connectedAccountId,
        stripe_account_status: accountStatus,
        preferred_payout_method: "stripe",
        // Store the connected account's email for reference
        billing_email: account.email || undefined
      })
      .eq("user_id", userId);

    if (updateError) {
      logStep("Failed to update profile", { error: updateError.message });
      throw new Error(`Failed to save Stripe account: ${updateError.message}`);
    }

    logStep("Successfully linked Stripe account", { 
      userId, 
      accountId: connectedAccountId,
      status: accountStatus 
    });

    // Redirect back to the app with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/?connect_success=true`,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Try to redirect with error, fallback to default origin
    const origin = "https://shake-web-buddy.lovable.app";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/?connect_error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
