import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[AUTO-PAYOUT-CREATORS] ${step}${detailsStr}`);
};

// Parse price string like "$5", "5", "€10" into a dollar amount (ignores currency symbol —
// checkout always charges in USD regardless of the symbol shown, see create-activity-payment).
function parsePriceAmount(priceString: string): number {
  const match = priceString.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth: service role key required (cron caller)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== serviceRoleKey) {
    console.warn("[AUTO-PAYOUT-CREATORS] Unauthorized call");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Events that have started within the last 48h — wide enough to catch every
    // timezone's "same day" without needing per-city local-time math, narrow
    // enough to not re-scan the whole activity history every run.
    const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date().toISOString();

    const { data: activities, error: activitiesError } = await supabase
      .from("user_activities")
      .select("id, user_id, price_amount, scheduled_for")
      .not("price_amount", "is", null)
      .eq("is_active", true)
      .gte("scheduled_for", windowStart)
      .lte("scheduled_for", windowEnd);

    if (activitiesError) throw activitiesError;

    logStep("Activities in payout window", { count: activities?.length ?? 0, windowStart, windowEnd });

    const results: Record<string, unknown>[] = [];

    for (const activity of activities || []) {
      const { count: participants } = await supabase
        .from("activity_joins")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", activity.id);

      const paidParticipants = participants || 0;
      if (paidParticipants === 0) {
        continue;
      }

      const unitAmount = parsePriceAmount(activity.price_amount || "");
      const gross = unitAmount * paidParticipants;
      const net = Math.round(gross * 0.85 * 100) / 100; // 85% after platform fee

      if (net <= 0) continue;

      // Already auto-paid for this specific activity?
      const { data: existingPayout } = await supabase
        .from("creator_payouts")
        .select("id")
        .eq("payout_method", "stripe_auto")
        .contains("activity_ids", [activity.id])
        .maybeSingle();

      if (existingPayout) {
        continue;
      }

      const { data: privateProfile } = await supabase
        .from("profiles_private")
        .select("stripe_account_id, stripe_account_status")
        .eq("user_id", activity.user_id)
        .maybeSingle();

      if (!privateProfile?.stripe_account_id || privateProfile.stripe_account_status !== "complete") {
        // Not on Stripe (or not verified yet) — leave for the manual payout flow.
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(net * 100),
          currency: "usd",
          destination: privateProfile.stripe_account_id,
          transfer_group: activity.id,
          description: `SHAKE payout for activity ${activity.id}`,
        });

        await supabase.from("creator_payouts").insert({
          creator_user_id: activity.user_id,
          amount: net,
          currency: "USD",
          payout_method: "stripe_auto",
          stripe_account_id: privateProfile.stripe_account_id,
          notes: `Automatic payout — activity happened ${activity.scheduled_for}`,
          activity_ids: [activity.id],
          paid_by: "system",
        });

        logStep("Transferred", { activityId: activity.id, creatorId: activity.user_id, net, transferId: transfer.id });
        results.push({ activityId: activity.id, creatorId: activity.user_id, net, transferId: transfer.id, status: "paid" });
      } catch (transferErr) {
        const msg = transferErr instanceof Error ? transferErr.message : String(transferErr);
        logStep("ERROR: transfer failed", { activityId: activity.id, creatorId: activity.user_id, error: msg });
        results.push({ activityId: activity.id, creatorId: activity.user_id, net, status: "failed", error: msg });
      }
    }

    logStep("Run complete", { processed: results.length });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
