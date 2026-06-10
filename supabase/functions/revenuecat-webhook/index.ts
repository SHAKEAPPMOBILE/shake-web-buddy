import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REVENUECAT-WEBHOOK] ${step}${detailsStr}`);
};

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

    // RevenueCat does not sign webhook payloads. It sends the literal value
    // configured under Integrations → Webhooks → "Authorization header" in the
    // dashboard. That field must be set to this secret (a "Bearer " prefix is
    // tolerated either way).
    const authHeader = req.headers.get("authorization") ?? "";
    const providedSecret = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : authHeader;
    if (providedSecret !== webhookSecret) {
      logStep("Invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = await req.json();
    const eventType = event.event?.type;
    const appUserId = event.event?.app_user_id;
    logStep("Event received", { type: eventType, app_user_id: appUserId });

    if (!appUserId) {
      logStep("No app_user_id in event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Purchases made before Purchases.logIn() are attributed to an anonymous
    // RevenueCat user and cannot be matched to a Supabase profile. Log loudly:
    // each of these is a paying user who won't receive premium automatically.
    if (appUserId.startsWith("$RCAnonymousID")) {
      logStep("WARNING: anonymous app_user_id — purchase cannot be linked to a profile", {
        appUserId,
        eventType,
        productId: event.event?.product_id,
      });
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // The app's entitlement identifier is "Premium" (case-sensitive in the client
    // + RevenueCat dashboard), with legacy "superhuman" also accepted. Match
    // case-insensitively here so a dashboard/casing mismatch can never silently
    // drop a paid user's premium status.
    const PREMIUM_ENTITLEMENT_KEYS = ["premium", "superhuman"];
    const isPremiumKey = (key: string) =>
      PREMIUM_ENTITLEMENT_KEYS.includes(key.toLowerCase());

    // Webhook events carry granted entitlements in `entitlement_ids` (array) /
    // `entitlement_id` (legacy single field).
    const entitlementIds: string[] = Array.isArray(event.event?.entitlement_ids)
      ? event.event.entitlement_ids
      : event.event?.entitlement_id
        ? [event.event.entitlement_id]
        : [];
    const grantsPremiumEntitlement = entitlementIds.some(isPremiumKey);

    // The premium product (Superhuman01) is a NON-CONSUMABLE: buying it fires
    // NON_RENEWING_PURCHASE (not INITIAL_PURCHASE), it never expires, and the
    // only revocation that applies to it is a refund. The subscription event
    // types are kept so a future switch to auto-renewable subscriptions keeps
    // working.
    const grantEvents = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE",
    ];

    // null = this event does not change premium status; don't touch the DB.
    // Unknown event types (TEST, TRANSFER, PRODUCT_CHANGE, ...) must never
    // overwrite a paying user's status.
    let isPremium: boolean | null = null;

    if (grantEvents.includes(eventType)) {
      if (grantsPremiumEntitlement) {
        isPremium = true;
        logStep("Premium purchase event - granting premium", { eventType, entitlementIds });
      } else {
        // e.g. a legacy donation product not attached to the Premium entitlement
        logStep("Purchase without premium entitlement - ignoring", {
          eventType,
          entitlementIds,
          productId: event.event?.product_id,
        });
      }
    } else if (eventType === "EXPIRATION") {
      // Access actually ended (subscription lapsed). Only revoke when the
      // expired entitlement is actually the premium one — expiration of an
      // unrelated product must not strip premium granted via Stripe or a
      // still-valid Apple purchase.
      if (grantsPremiumEntitlement) {
        isPremium = false;
        logStep("Expiration event - removing premium");
      } else {
        logStep("Expiration without premium entitlement - ignoring", { entitlementIds });
      }
    } else if (eventType === "CANCELLATION") {
      // CANCELLATION means auto-renew was disabled OR a refund was issued
      // (cancellation_reason distinguishes). Auto-renew opt-out keeps access
      // until the paid period ends — EXPIRATION fires then. Only refunds
      // revoke immediately, and only when the refunded product carried the
      // premium entitlement.
      if (event.event?.cancellation_reason === "CUSTOMER_SUPPORT") {
        if (grantsPremiumEntitlement) {
          isPremium = false;
          logStep("Refund - removing premium");
        } else {
          logStep("Refund without premium entitlement - ignoring", { entitlementIds });
        }
      } else {
        logStep("Auto-renew disabled - keeping premium until EXPIRATION", {
          reason: event.event?.cancellation_reason,
        });
      }
    } else if (eventType === "BILLING_ISSUE") {
      // Grace period: RevenueCat keeps the entitlement active while Apple
      // retries billing; EXPIRATION follows if it can't be resolved.
      logStep("Billing issue - keeping premium until EXPIRATION");
    } else {
      logStep("Unhandled event type - no status change", { eventType });
    }

    if (isPremium !== null) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // app_user_id is the Supabase user ID (set via Purchases.logIn in the app)
      const { data: updated, error: updateError } = await supabaseClient
        .from("profiles_private")
        .update({ premium_override: isPremium })
        .eq("user_id", appUserId)
        .select("user_id");

      if (updateError) {
        logStep("Error updating user premium status", { error: updateError.message, userId: appUserId });
        // Don't throw - we still want to acknowledge the webhook
      } else if (!updated || updated.length === 0) {
        // A zero-row update is not an error in PostgREST — surface it, because
        // it means a real purchase event couldn't be applied to any profile.
        logStep("WARNING: no profiles_private row matched app_user_id", { appUserId, isPremium });
      } else {
        logStep("Updated user premium status", { userId: appUserId, isPremium });
      }
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
