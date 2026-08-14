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
    logStep("Function started - Stripe Connect Standard via Account Links");

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

    // Parse request body
    let reset = false;
    let country: string | undefined;
    try {
      const body = await req.json();
      reset = body?.reset === true;
      country = body?.country || undefined;
      logStep("Parsed body", { reset, country });
    } catch {
      // No body or invalid JSON, that's fine
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

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
      // Check if this is an existing account
      try {
        const account = await stripe.accounts.retrieve(privateProfile.stripe_account_id);

        if (account.type === "express") {
          logStep("Found old Express account, clearing to recreate as Standard", {
            accountId: privateProfile.stripe_account_id,
            type: account.type
          });
          await supabaseClient
            .from("profiles_private")
            .update({
              stripe_account_id: null,
              stripe_account_status: null
            })
            .eq("user_id", user.id);
          // Continue to account creation below
        } else if (account.type === "standard") {
          // Already have a Standard account - check its status
          if (account.charges_enabled && account.payouts_enabled) {
            // Account is complete
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

          const requirements = account.requirements;
          const hasOutstandingRequirements =
            !account.details_submitted ||
            (requirements?.currently_due?.length ?? 0) > 0 ||
            (requirements?.past_due?.length ?? 0) > 0;

          if (hasOutstandingRequirements) {
            // Onboarding was never finished (or Stripe now needs more info) —
            // Stripe is waiting on the USER here, not doing internal review,
            // so telling them to "wait 1-3 days" would be a dead end. Send
            // them back into a fresh Account Link to finish the remaining
            // fields instead of falling through to "verification_pending".
            logStep("Standard account has outstanding requirements, resuming onboarding", {
              accountId: privateProfile.stripe_account_id,
              detailsSubmitted: account.details_submitted,
              currentlyDue: requirements?.currently_due,
              pastDue: requirements?.past_due,
            });
            // Falls through to the account-link creation below, reusing this
            // existing account.id instead of creating a new one.
          } else {
            // Details submitted, no outstanding requirements — genuinely
            // waiting on Stripe's own verification.
            logStep("Standard account is under Stripe verification", {
              accountId: privateProfile.stripe_account_id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
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
        } else {
          // Unknown account type, clear and restart
          logStep("Unknown account type, clearing", { 
            accountId: privateProfile.stripe_account_id,
            type: account.type
          });
          await supabaseClient
            .from("profiles_private")
            .update({ 
              stripe_account_id: null, 
              stripe_account_status: null 
            })
            .eq("user_id", user.id);
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
    }

    // Always use the web app origin for the return redirect — Capacitor native
    // sends origin: "capacitor://localhost" which can't receive the redirect.
    const rawOrigin = req.headers.get("origin") || "";
    const origin = (rawOrigin && !rawOrigin.includes("capacitor://") && !rawOrigin.includes("localhost"))
      ? rawOrigin
      : "https://shakeapp.today";

    logStep("Using origin for return links", { rawOrigin, origin });

    // Re-fetch the (possibly just-cleared) stripe_account_id — if an existing
    // Standard account still just needs to finish onboarding, reuse it
    // instead of creating a duplicate Stripe account on every retry.
    const { data: reloadedProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, billing_email")
      .eq("user_id", user.id)
      .maybeSingle();

    const email = reloadedProfile?.billing_email || user.email || undefined;
    let accountId = reloadedProfile?.stripe_account_id ?? null;

    if (!accountId) {
      // Create a new Standard connected account directly via the API —
      // no OAuth Client ID needed, just the platform's secret key.
      const account = await stripe.accounts.create({
        type: "standard",
        country,
        email,
      });
      accountId = account.id;

      logStep("Created Standard account", { accountId, country: country || "not set" });

      await supabaseClient
        .from("profiles_private")
        .update({
          stripe_account_id: accountId,
          stripe_account_status: "pending",
        })
        .eq("user_id", user.id);
    } else {
      logStep("Reusing existing Standard account to resume onboarding", { accountId });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/?connect_refresh=true`,
      return_url: `${origin}/?connect_success=true`,
      type: "account_onboarding",
    });

    logStep("Generated onboarding link", { accountId });

    return new Response(JSON.stringify({
      url: accountLink.url,
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
