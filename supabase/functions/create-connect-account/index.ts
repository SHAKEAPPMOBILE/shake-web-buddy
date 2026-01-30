import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    // Get Stripe Client ID for OAuth
    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID");
    if (!stripeClientId) {
      throw new Error("STRIPE_CLIENT_ID is not configured");
    }

    // Check if user already has a connected account
    const { data: privateProfile } = await supabaseClient
      .from("profiles_private")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (privateProfile?.stripe_account_id && privateProfile?.stripe_account_status === "complete") {
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
      clientId: stripeClientId.substring(0, 10) + "...",
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
