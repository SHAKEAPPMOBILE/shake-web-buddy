import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const requestBody = await req.json().catch(() => ({}));
    logStep("Request body parsed", {
      hasUserId: typeof requestBody?.userId === "string",
      emailProvided: typeof requestBody?.email === "string" && requestBody.email,
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    let email: string | null = typeof requestBody?.email === "string" ? requestBody.email.trim() : null;

    // If Authorization is present, prefer the authenticated user's email.
    if (token) {
      logStep("Authorization header present - fetching user", {
        tokenPreview: token.slice(0, 8) + "...",
      });
      const { data } = await supabaseClient.auth.getUser(token);
      const user = data.user;

      if (!user?.id) {
        logStep("Auth user not found in token");
      } else {
        email = user.email ?? email;
        logStep("Authenticated user resolved", { userId: user.id, emailPresent: !!email });
      }
    } else {
      logStep("No Authorization header - using body email if provided");
    }

    // If no auth email, check for billing_email in profiles_private
    if (!email) {
      const bodyUserId = typeof requestBody?.userId === "string" ? requestBody.userId : null;
      if (!bodyUserId) {
        logStep("Cannot resolve email - missing both Authorization and requestBody.userId");
      } else {
        logStep("Checking profiles_private for billing_email", { userId: bodyUserId });
        const { data: privateProfile } = await supabaseClient
          .from("profiles_private")
          .select("billing_email")
          .eq("user_id", bodyUserId)
          .maybeSingle();

        if (privateProfile?.billing_email) {
          email = privateProfile.billing_email;
          logStep("Found billing_email in profile", { emailPresent: !!email });
        }
      }
    }

    if (!email) {
      throw new Error("Email required for subscription. Please add an email address in your profile settings.");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      logStep("STRIPE_SECRET_KEY missing");
      return new Response(JSON.stringify({
        error: "Stripe is not configured (STRIPE_SECRET_KEY is missing). Please contact support.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    const priceId =
      Deno.env.get("STRIPE_PRICE_ID") ||
      "price_1TcYkFE15hgUkq5H7tk1JrtS";
    if (!priceId) {
      logStep("Stripe price id missing");
      return new Response(JSON.stringify({
        error: "Stripe is not configured (subscription price id is missing). Please contact support.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Creating checkout session", {
      emailPresent: !!email,
      priceId,
      origin: req.headers.get("origin") || "default",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Optional: let us correlate the checkout session to the app user.
      client_reference_id: typeof requestBody?.userId === "string" ? requestBody.userId : undefined,
      success_url: `${origin}/subscription-success`,
      cancel_url: `${origin}/?subscription=canceled`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = error as any;
    const stripeError = err?.type === "StripeError" ? err : null;
    const errorPayload = {
      message: err?.message || String(error),
      name: err?.name,
      code: err?.code,
      type: err?.type,
      statusCode: err?.statusCode,
      requestId: err?.requestId,
      // Stripe SDK sometimes includes `raw` with structured details.
      raw: err?.raw ? err.raw : undefined,
    };

    logStep("ERROR", errorPayload);
    return new Response(JSON.stringify({
      error: errorPayload.message || "Failed to create checkout session",
      details: errorPayload,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      // Return 200 so the client can read `data.error` and show a clear message.
      status: 200,
    });
  }
});
