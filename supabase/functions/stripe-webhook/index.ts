import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    // Resend is only used for subscription-cancellation emails — do not require it for checkout webhooks
    // or every Stripe event would 500 when RESEND_API_KEY is missing from Edge Function secrets.

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMsg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type });

    // One-time Checkout: completed may arrive before payment settles (e.g. async methods). async_payment_succeeded is the reliable "paid" signal.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      try {
      const session = event.data.object as Stripe.Checkout.Session;
      const isAsyncPaymentSuccess = event.type === "checkout.session.async_payment_succeeded";
      const metadata = session.metadata || {};
      const activityId = metadata.activity_id;
      const eventId = String(metadata.event_id ?? "").trim();
      const payerUserId = String(metadata.payer_user_id ?? metadata.user_id ?? "").trim();

      const paymentReady =
        isAsyncPaymentSuccess ||
        session.mode !== "payment" ||
        session.payment_status === "paid";

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Activity payments: add user to activity_joins
      if (activityId && payerUserId && paymentReady) {
        logStep("Processing activity payment completion", { activityId, payerUserId });

        const { data: activity } = await supabaseClient
          .from("user_activities")
          .select("activity_type, city")
          .eq("id", activityId)
          .maybeSingle();

        if (activity) {
          const { error: joinError } = await supabaseClient
            .from("activity_joins")
            .insert({
              user_id: payerUserId,
              activity_id: activityId,
              activity_type: activity.activity_type,
              city: activity.city,
            });

          if (joinError) {
            logStep("Error joining activity after payment (acknowledging webhook anyway)", {
              error: joinError.message,
              code: joinError.code,
            });
          } else {
            logStep("User joined activity after payment", { activityId, payerUserId });
          }
        }
      }

      // Event chat payments: parent row first, then membership (FK). Log DB errors but return 200 so Stripe does not
      // disable the endpoint; investigate via logs / resend failed events after deploy.
      const isEventChatCheckout = Boolean(eventId && payerUserId);
      if (isEventChatCheckout) {
        if (!paymentReady) {
          logStep("Deferring event chat fulfillment until payment is paid (async or later webhook)", {
            eventId,
            payerUserId,
            payment_status: session.payment_status,
            sessionId: session.id,
            eventType: event.type,
          });
        } else {
          const eventName = (metadata.event_name || "Event chat").trim() || "Event chat";
          const startsAtRaw = String(metadata.event_starts_at ?? "").trim() || null;
          const amountParsed = parseInt(metadata.amount_cents ?? "", 10);
          const amountCents = Number.isFinite(amountParsed) && amountParsed > 0 ? amountParsed : 100;

          logStep("Event chat metadata from Stripe (must match frontend event.id)", {
            metadata_event_id: eventId,
            payerUserId,
            has_event_starts_at: Boolean(startsAtRaw),
            amount_cents: amountCents,
          });

          let expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
          let eventStartsAtIso: string | null = null;
          if (startsAtRaw) {
            const start = new Date(startsAtRaw);
            if (!isNaN(start.getTime())) {
              eventStartsAtIso = start.toISOString();
              expiresAt = new Date(start.getTime() + 12 * 60 * 60 * 1000);
            }
          }

          logStep("Processing event chat payment completion", {
            eventId,
            payerUserId,
            eventName,
            expiresAt: expiresAt.toISOString(),
            event_starts_at: eventStartsAtIso,
          });

          const { error: upsertChatError } = await supabaseClient
            .from("event_chats")
            .upsert(
              {
                event_id: eventId,
                name: eventName,
                expires_at: expiresAt.toISOString(),
              },
              { onConflict: "event_id" },
            );

          if (upsertChatError) {
            logStep("ERROR: event_chats upsert failed after payment", {
              error: upsertChatError.message,
              code: upsertChatError.code,
              eventId,
            });
          }

          const paidAtIso = new Date().toISOString();

          if (upsertChatError) {
            logStep("Skipping event_chat_members upsert (event_chats row missing)", { eventId, payerUserId });
          } else {
            logStep("Upserting event_chat_members", {
              event_id: eventId,
              user_id: payerUserId,
              paid_at: paidAtIso,
            });

            let memberError = (
              await supabaseClient
                .from("event_chat_members")
                .upsert(
                  {
                    event_id: eventId,
                    user_id: payerUserId,
                    paid_at: paidAtIso,
                    expires_at: expiresAt.toISOString(),
                    event_name: eventName,
                    event_starts_at: eventStartsAtIso,
                    amount_cents: amountCents,
                  },
                  { onConflict: "event_id,user_id" },
                )
            ).error;

            // If DB has not migrated `amount_cents` yet, retry without it so fulfillment still succeeds.
            if (
              memberError &&
              /amount_cents/i.test(memberError.message ?? "") &&
              /does not exist|schema cache/i.test(memberError.message ?? "")
            ) {
              logStep("WARN: retrying event_chat_members upsert without amount_cents", { eventId });
              memberError = (
                await supabaseClient
                  .from("event_chat_members")
                  .upsert(
                    {
                      event_id: eventId,
                      user_id: payerUserId,
                      paid_at: paidAtIso,
                      expires_at: expiresAt.toISOString(),
                      event_name: eventName,
                      event_starts_at: eventStartsAtIso,
                    },
                    { onConflict: "event_id,user_id" },
                  )
              ).error;
            }

            if (memberError) {
              logStep("ERROR: event_chat_members upsert failed after payment", {
                error: memberError.message,
                code: memberError.code,
                eventId,
                payerUserId,
              });
            } else {
              logStep("User joined event chat after payment", { eventId, payerUserId });
            }
          }
        }
      } else if (session.mode === "payment" && metadata.event_name && !activityId) {
        logStep("WARN: paid checkout has event_name but missing event_id or user id in metadata", {
          sessionId: session.id,
          metadata_keys: Object.keys(metadata),
        });
      }
      } catch (checkoutHandlerErr) {
        const msg = checkoutHandlerErr instanceof Error ? checkoutHandlerErr.message : String(checkoutHandlerErr);
        const stack = checkoutHandlerErr instanceof Error ? checkoutHandlerErr.stack : undefined;
        logStep("ERROR: checkout session handler threw (acknowledging webhook to Stripe)", {
          message: msg,
          stack,
        });
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle subscription cancellation events
    if (event.type === "customer.subscription.deleted" || 
        (event.type === "customer.subscription.updated" && 
         (event.data.object as Stripe.Subscription).cancel_at_period_end === true)) {
      try {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      logStep("Processing subscription cancellation", { 
        subscriptionId: subscription.id, 
        customerId,
        eventType: event.type 
      });

      // Get customer email from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        logStep("Customer was deleted, skipping email");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const customerEmail = customer.email;
      const customerName = customer.name || "Valued Customer";

      if (!customerEmail) {
        logStep("No customer email found, skipping notification");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("Sending cancellation email", { email: customerEmail });

      // Determine if it's immediate cancellation or end-of-period
      const isCancelled = event.type === "customer.subscription.deleted";
      const cancelAtPeriodEnd = (event.data.object as Stripe.Subscription).cancel_at_period_end;
      
      let subject: string;
      let htmlContent: string;

      if (isCancelled) {
        subject = "Your SHAKE Super-Human subscription has been cancelled";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Hi ${customerName} 👋</h1>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                We're sorry to see you go! Your <strong>Super-Human</strong> subscription has been cancelled.
              </p>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                You'll no longer have access to premium features like:
              </p>
              
              <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
                <li>Creating unlimited activities</li>
                <li>Access to 100+ cities worldwide</li>
                <li>Joining activities in any city</li>
                <li>Unlimited voice & text messages</li>
              </ul>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Changed your mind? You can always resubscribe from the app to get your Super-Human powers back! 🦸
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #888; font-size: 14px;">
                  Thank you for being part of the SHAKE community!<br>
                  — The SHAKE Team
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
      } else if (cancelAtPeriodEnd) {
        const periodEnd = new Date((subscription.current_period_end as number) * 1000);
        const formattedDate = periodEnd.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        subject = "Your SHAKE Super-Human subscription will be cancelled";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Hi ${customerName} 👋</h1>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                We've received your cancellation request for the <strong>Super-Human</strong> subscription.
              </p>
              
              <div style="background-color: #fff8e6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="color: #4a4a4a; font-size: 16px; margin: 0;">
                  📅 Your premium access will remain active until <strong>${formattedDate}</strong>
                </p>
              </div>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                After this date, you'll no longer have access to premium features like unlimited activities, worldwide city access, and unlimited messaging.
              </p>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Changed your mind? You can reactivate your subscription anytime before ${formattedDate} from the app! 🦸
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #888; font-size: 14px;">
                  Thank you for being part of the SHAKE community!<br>
                  — The SHAKE Team
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
      } else {
        // Not a cancellation event we need to handle
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        logStep("RESEND_API_KEY not set; skipping cancellation email (webhook still OK)", {
          customerEmail,
        });
      } else {
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: "SHAKE <noreply@shakeapp.today>",
          to: [customerEmail],
          subject: subject,
          html: htmlContent,
        });

        if (emailError) {
          logStep("Failed to send cancellation email", { error: emailError });
        } else {
          logStep("Cancellation email sent successfully", { email: customerEmail });
        }
      }
      } catch (subscriptionHandlerErr) {
        const msg = subscriptionHandlerErr instanceof Error ? subscriptionHandlerErr.message : String(subscriptionHandlerErr);
        const stack = subscriptionHandlerErr instanceof Error ? subscriptionHandlerErr.stack : undefined;
        logStep("ERROR: subscription cancellation handler threw (acknowledging webhook to Stripe)", {
          message: msg,
          stack,
        });
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
