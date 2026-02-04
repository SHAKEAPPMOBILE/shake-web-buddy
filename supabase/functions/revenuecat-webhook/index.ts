import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-revenuecat-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REVENUECAT-WEBHOOK] ${step}${detailsStr}`);
};

// Verify RevenueCat webhook signature
async function verifySignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) {
    logStep("No signature provided");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // RevenueCat sends signature in format: sha256=<hex>
    const expectedSignature = signature.replace('sha256=', '');
    
    return computedSignature === expectedSignature;
  } catch (error) {
    logStep("Signature verification error", { error: String(error) });
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("REVENUECAT_WEBHOOK_SECRET is not set");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("x-revenuecat-signature");

    // Verify webhook signature
    const isValid = await verifySignature(body, signature, webhookSecret);
    if (!isValid) {
      logStep("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    logStep("Event received", { type: event.event?.type, app_user_id: event.event?.app_user_id });

    const eventType = event.event?.type;
    const appUserId = event.event?.app_user_id;
    
    if (!appUserId) {
      logStep("No app_user_id in event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Map RevenueCat events to subscription status updates
    const premiumEvents = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE", // For one-time purchases like donations (optional tracking)
    ];

    const nonPremiumEvents = [
      "CANCELLATION",
      "EXPIRATION",
      "BILLING_ISSUE",
    ];

    // Get subscription info from event
    const subscriberInfo = event.event?.subscriber_info;
    const entitlements = subscriberInfo?.entitlements;
    
    // Check if user has active "premium" or "superhuman" entitlement
    const hasPremiumEntitlement = entitlements?.premium?.expires_date || 
                                   entitlements?.superhuman?.expires_date;
    
    let isPremium = false;
    let subscriptionEnd: string | null = null;

    if (premiumEvents.includes(eventType)) {
      isPremium = true;
      // Get expiration date from the entitlement
      const expiresDate = entitlements?.premium?.expires_date || 
                          entitlements?.superhuman?.expires_date ||
                          event.event?.expiration_at_ms;
      
      if (expiresDate) {
        subscriptionEnd = typeof expiresDate === 'number' 
          ? new Date(expiresDate).toISOString()
          : expiresDate;
      }
      logStep("Premium event - setting premium status", { isPremium, subscriptionEnd });
    } else if (nonPremiumEvents.includes(eventType)) {
      isPremium = false;
      logStep("Non-premium event - removing premium status");
    } else {
      // For other events, check current entitlement status
      if (hasPremiumEntitlement) {
        const expiresDate = entitlements?.premium?.expires_date || 
                            entitlements?.superhuman?.expires_date;
        if (expiresDate && new Date(expiresDate) > new Date()) {
          isPremium = true;
          subscriptionEnd = expiresDate;
        }
      }
      logStep("Other event - checked entitlement", { isPremium, subscriptionEnd });
    }

    // Update user's premium status in profiles_private
    // app_user_id should be the Supabase user ID
    const { error: updateError } = await supabaseClient
      .from("profiles_private")
      .update({
        premium_override: isPremium,
        // Store RevenueCat subscription end if available
        // Note: We're using premium_override for RevenueCat-managed subscriptions
        // This differs from Stripe which uses the check-subscription function
      })
      .eq("user_id", appUserId);

    if (updateError) {
      logStep("Error updating user premium status", { error: updateError.message, userId: appUserId });
      // Don't throw - we still want to acknowledge the webhook
    } else {
      logStep("Updated user premium status", { userId: appUserId, isPremium });
    }

    // Handle Kind Human donations (non-renewing purchases)
    if (eventType === "NON_RENEWING_PURCHASE") {
      const productId = event.event?.product_id;
      const price = event.event?.price;
      const currency = event.event?.currency;
      
      logStep("Kind Human donation received", { 
        productId, 
        price, 
        currency, 
        userId: appUserId 
      });
      // You could track donations in a separate table here if needed
    }

    return new Response(JSON.stringify({ received: true }), {
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
