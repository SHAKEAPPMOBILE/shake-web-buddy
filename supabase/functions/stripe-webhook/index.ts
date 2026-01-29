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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const resend = new Resend(resendApiKey);

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

    // Handle checkout session completed for activity payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is an activity payment (has activity_id in metadata)
      const activityId = session.metadata?.activity_id;
      const payerUserId = session.metadata?.payer_user_id;
      
      if (activityId && payerUserId) {
        logStep("Processing activity payment completion", { activityId, payerUserId });
        
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );
        
        // Get activity details
        const { data: activity } = await supabaseClient
          .from("user_activities")
          .select("activity_type, city")
          .eq("id", activityId)
          .maybeSingle();
        
        if (activity) {
          // Add user to activity_joins
          const { error: joinError } = await supabaseClient
            .from("activity_joins")
            .insert({
              user_id: payerUserId,
              activity_id: activityId,
              activity_type: activity.activity_type,
              city: activity.city,
            });
          
          if (joinError) {
            logStep("Error joining activity after payment", { error: joinError.message });
          } else {
            logStep("User joined activity after payment", { activityId, payerUserId });
          }
        }
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

      // Send the email using Resend
      const { error: emailError } = await resend.emails.send({
        from: "SHAKE <noreply@shakeapp.today>",
        to: [customerEmail],
        subject: subject,
        html: htmlContent,
      });

      if (emailError) {
        logStep("Failed to send cancellation email", { error: emailError });
        // Don't throw - we still want to acknowledge the webhook
      } else {
        logStep("Cancellation email sent successfully", { email: customerEmail });
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
