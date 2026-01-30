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
    logStep("Function started - Stripe Connect Standard OAuth");

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

    // Parse request body to check for reset flag
    let reset = false;
    try {
      const body = await req.json();
      reset = body?.reset === true;
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Get Stripe Client ID for OAuth
    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID");
    if (!stripeClientId) {
      throw new Error("STRIPE_CLIENT_ID is not configured");
    }

    // Validate Client ID format - should start with 'ca_'
    if (!stripeClientId.startsWith("ca_")) {
      logStep("Invalid STRIPE_CLIENT_ID format", { 
        prefix: stripeClientId.substring(0, 10),
        hint: "Client ID should start with 'ca_', not 'acct_'"
      });
      throw new Error("Invalid STRIPE_CLIENT_ID configuration. The Client ID should start with 'ca_'. Please check your Stripe Connect settings in the Stripe Dashboard under Connect > Settings > OAuth settings.");
    }

    // Check if user already has a connected account
    const { data: privateProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", user.id)
      .maybeSingle();

    // If reset is requested, clear the existing account
    if (reset && privateProfile?.stripe_account_id) {
      logStep("Resetting existing Stripe account", { 
        oldAccountId: privateProfile.stripe_account_id 
      });
      await supabaseClient
        .from("profiles_private")
        .update({ 
          stripe_account_id: null, 
          stripe_account_status: null 
        })
        .eq("user_id", user.id);
    } else if (privateProfile?.stripe_account_id) {
      // If user has an existing account that's pending, check if we should send them to Stripe dashboard
      if (privateProfile.stripe_account_status === "pending") {
        // Check the actual account status with Stripe
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2025-08-27.basil",
        });
        
        try {
          const account = await stripe.accounts.retrieve(privateProfile.stripe_account_id);
          
          // If account exists and has started onboarding, send them to the account link
          // to continue/complete their onboarding rather than OAuth
          if (account) {
            // Check if they need to complete requirements
            const requirements = account.requirements;
            const hasOutstandingRequirements = 
              (requirements?.currently_due?.length ?? 0) > 0 ||
              (requirements?.eventually_due?.length ?? 0) > 0 ||
              (requirements?.past_due?.length ?? 0) > 0;
            
            if (hasOutstandingRequirements) {
              // Create an account link for them to complete onboarding
              const origin = req.headers.get("origin") || "https://shake-web-buddy.lovable.app";
              const accountLink = await stripe.accountLinks.create({
                account: privateProfile.stripe_account_id,
                refresh_url: `${origin}/?connect_refresh=true`,
                return_url: `${origin}/?connect_success=true`,
                type: "account_onboarding",
              });
              
              logStep("Created account link for pending account", { 
                accountId: privateProfile.stripe_account_id,
                hasRequirements: true
              });
              
              return new Response(JSON.stringify({ 
                url: accountLink.url,
                status: "redirect",
                message: "Continue your Stripe onboarding"
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
            
            // Account is complete
            if (account.charges_enabled && account.payouts_enabled) {
              // Update status in database
              await supabaseClient
                .from("profiles_private")
                .update({ 
                  stripe_account_status: "complete",
                  preferred_payout_method: "stripe"
                })
                .eq("user_id", user.id);
                
              return new Response(JSON.stringify({ 
                status: "complete",
                message: "Your Stripe account is already connected and verified" 
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
            
            // Account is under verification - nothing to do but wait
            logStep("Account is under Stripe verification", { 
              accountId: privateProfile.stripe_account_id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled
            });
            
            return new Response(JSON.stringify({ 
              status: "verification_pending",
              message: "Stripe is still verifying your account. This can take 1-3 business days.",
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } catch (stripeError) {
          // Account might be invalid or deleted, clear it
          logStep("Existing account is invalid, clearing", { 
            error: stripeError instanceof Error ? stripeError.message : String(stripeError)
          });
          await supabaseClient
            .from("profiles_private")
            .update({ 
              stripe_account_id: null, 
              stripe_account_status: null 
            })
            .eq("user_id", user.id);
        }
      } else if (privateProfile.stripe_account_status === "complete") {
        logStep("User already has a connected Stripe account", { 
          accountId: privateProfile.stripe_account_id 
        });
        return new Response(JSON.stringify({ 
          status: "complete",
          message: "Your Stripe account is already connected" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Build Stripe OAuth authorization URL for Standard accounts
    const origin = req.headers.get("origin") || "https://shake-web-buddy.lovable.app";
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-connect-callback`;
    
    // Create a state parameter to prevent CSRF and pass user info
    const state = btoa(JSON.stringify({ 
      userId: user.id,
      origin: origin
    }));

    const oauthUrl = new URL("https://connect.stripe.com/oauth/authorize");
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("client_id", stripeClientId);
    oauthUrl.searchParams.set("scope", "read_write");
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("state", state);
    
    // Pre-fill user email if available
    const { data: profileData } = await supabaseClient
      .from("profiles_private")
      .select("billing_email")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (profileData?.billing_email || user.email) {
      oauthUrl.searchParams.set("stripe_user[email]", profileData?.billing_email || user.email || "");
    }

    logStep("Generated OAuth URL", { 
      clientIdPrefix: stripeClientId.substring(0, 6) + "...",
      redirectUri 
    });

    return new Response(JSON.stringify({ 
      url: oauthUrl.toString(),
      status: "redirect"
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
