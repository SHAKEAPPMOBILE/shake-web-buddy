import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendEmail } from "../_shared/postmark-email-service.ts";

// Mirrors the wizard's own built-in types — only needs to cover the carousel
// activities; anything else falls back to activity_type as-is.
const ACTIVITY_LABELS: Record<string, string> = {
  dinner: "Dinner",
  drinks: "Drinks",
  brunch: "Brunch",
};

const MAX_GUEST_JOINS_PER_EMAIL = 2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const email: string = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name: string | null = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;
    const activityId: string | null = typeof body?.activity_id === "string" ? body.activity_id : null;
    const rawActivityType: string | undefined = body?.activity_type;
    const rawCity: string | undefined = body?.city;
    const rawScheduledFor: string | undefined = body?.scheduled_for;

    if (!email || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let activityType: string;
    let city: string;
    let scheduledFor: string | null;
    let joinKey: string;
    let planLabel: string;

    if (activityId) {
      // Real plan — must be active, free, and open to everyone. No account
      // means no payment identity and no way to check women_only/friends_only.
      const { data: activity, error } = await supabase
        .from("user_activities")
        .select("id, activity_type, city, scheduled_for, note, price_amount, audience, is_active, capacity")
        .eq("id", activityId)
        .maybeSingle();
      if (error || !activity || !activity.is_active) {
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (activity.price_amount) {
        return new Response(JSON.stringify({ error: "This plan requires an account to pay for a spot" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (activity.audience && activity.audience !== "everyone") {
        return new Response(JSON.stringify({ error: "This plan requires an account to verify you're eligible to join" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (activity.capacity) {
        const [{ count: realCount }, { count: guestCount }] = await Promise.all([
          supabase.from("activity_joins").select("id", { count: "exact", head: true }).eq("activity_id", activityId),
          supabase.from("guest_joins").select("id", { count: "exact", head: true }).eq("activity_id", activityId),
        ]);
        if ((realCount ?? 0) + (guestCount ?? 0) >= activity.capacity) {
          return new Response(JSON.stringify({ error: "This plan is full" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      activityType = activity.activity_type;
      city = activity.city;
      scheduledFor = activity.scheduled_for;
      joinKey = activity.id;
      planLabel = activity.note?.trim() || ACTIVITY_LABELS[activity.activity_type] || activity.activity_type;
    } else {
      // Carousel/category activity — always free and open to everyone by
      // definition, no single row to validate against.
      if (!rawActivityType || !rawCity) {
        return new Response(JSON.stringify({ error: "activity_type and city are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      activityType = rawActivityType;
      city = rawCity;
      scheduledFor = rawScheduledFor ?? null;
      joinKey = `carousel:${activityType}:${city.toLowerCase()}`;
      planLabel = ACTIVITY_LABELS[activityType] || activityType;
    }

    // Idempotent: re-clicking the same invite link should just return the
    // existing join, not error or count twice against the cap.
    const { data: existingRow } = await supabase
      .from("guest_joins")
      .select("token")
      .eq("join_key", joinKey)
      .eq("email", email)
      .maybeSingle();

    let row = existingRow;
    if (!row) {
      // Cap at MAX_GUEST_JOINS_PER_EMAIL across every plan this email has
      // guest-joined, so this stays a light conversion nudge, not a way to
      // permanently avoid signing up.
      const { count: existingJoinCount } = await supabase
        .from("guest_joins")
        .select("id", { count: "exact", head: true })
        .eq("email", email);
      if ((existingJoinCount ?? 0) >= MAX_GUEST_JOINS_PER_EMAIL) {
        return new Response(
          JSON.stringify({ error: `You've already joined ${MAX_GUEST_JOINS_PER_EMAIL} plans without an account — sign up free to join more` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from("guest_joins")
        .insert({ join_key: joinKey, activity_id: activityId, activity_type: activityType, city, scheduled_for: scheduledFor, email, name })
        .select("token")
        .single();
      if (insertError || !insertedRow) {
        console.error("[guest-join-plan] insert error:", insertError);
        return new Response(JSON.stringify({ error: "Could not join the plan" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      row = insertedRow;
    }
    const isNewJoin = !existingRow;

    const guestUrl = `https://www.shakeapp.today/guest/${row.token}`;
    if (isNewJoin) void sendEmail({
      from: "SHAKE <noreply@shakeapp.today>",
      to: email,
      subject: `You're in! ${planLabel} on SHAKE`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 480px; margin: 0 auto; padding: 24px; }
            .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center; }
            .cta { display: inline-block; margin-top: 16px; background: #111827; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-weight: 600; }
            .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 22px;">🎉 You're in</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin: 0 0 4px;">You joined <strong>${planLabel}</strong> in ${city} on SHAKE.</p>
              <p style="font-size: 14px; color: #6b7280;">No account needed for this one — but sign up free any time to chat with the group and see everything else SHAKE has going on.</p>
              <a class="cta" href="${guestUrl}">View your plan</a>
            </div>
            <div class="footer">© 2026 SHAKE. All rights reserved.</div>
          </div>
        </body>
        </html>
      `,
      text: `You joined ${planLabel} in ${city} on SHAKE. No account needed for this one — sign up free any time to chat with the group. View it at ${guestUrl}`,
    }).catch((err) => console.error("[guest-join-plan] email failed:", err));

    return new Response(JSON.stringify({ success: true, token: row.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[guest-join-plan] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
