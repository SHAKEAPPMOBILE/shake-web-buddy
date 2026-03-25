import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-EVENT-CHAT-PAYMENT] ${step}${detailsStr}`);
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

    const body = await req.json();
    const { eventId, eventName, eventStartsAt } = body;

    if (!eventId || !eventName || !eventStartsAt) {
      throw new Error("eventId, eventName, and eventStartsAt are required");
    }

    logStep("Processing payment request", { userId: user.id, eventId });

    // Server-side idempotency guard: never create a new checkout session if the user
    // already has active membership for this exact event.
    const { data: existingMembership, error: existingMembershipError } = await supabaseClient
      .from("event_chat_members")
      .select("event_id, expires_at, paid_at")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembershipError) {
      logStep("Membership precheck query failed", { error: existingMembershipError.message, eventId, userId: user.id });
    }

    const resolveMembershipExpiry = (m: { expires_at?: string | null; paid_at?: string | null } | null) => {
      if (!m) return null;
      if (m.expires_at) {
        const d = new Date(m.expires_at);
        if (!isNaN(d.getTime())) return d;
      }
      if (m.paid_at) {
        const d = new Date(m.paid_at);
        if (!isNaN(d.getTime())) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
      return null;
    };

    const existingExpiry = resolveMembershipExpiry(existingMembership as { expires_at?: string | null; paid_at?: string | null } | null);
    if (existingMembership && (!existingExpiry || existingExpiry.getTime() > Date.now())) {
      logStep("Active membership found, skipping Stripe checkout", {
        eventId,
        userId: user.id,
        expiresAt: existingExpiry?.toISOString() ?? null,
      });
      return new Response(
        JSON.stringify({
          alreadyJoined: true,
          eventId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Get payer's email for Stripe
    const { data: payerPrivate } = await supabaseClient
      .from("profiles_private")
      .select("billing_email")
      .eq("user_id", user.id)
      .maybeSingle();

    const payerEmail = payerPrivate?.billing_email || user.email;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://shake-web-buddy.lovable.app";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Event Chat: ${eventName}`,
            },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/events/return?payment_success=true&event_id=${encodeURIComponent(eventId)}&chat_unlocked=${encodeURIComponent(eventId)}`,
      cancel_url: `${origin}/events/return?payment_cancelled=true`,
      customer_email: payerEmail || undefined,
      metadata: {
        event_id: eventId,
        payer_user_id: user.id,
        event_name: eventName,
        event_starts_at: eventStartsAt,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
        alreadyJoined: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
