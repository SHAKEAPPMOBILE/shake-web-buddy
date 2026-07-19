import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";

/**
 * Gate for joining a women-only plan. Returns true if the join may proceed.
 * When blocked, shows the appropriate toast itself (different wording depending
 * on whether the joiner's gender is unknown vs. explicitly not "woman") so callers
 * just need to bail out on `false`.
 *
 * The Postgres trigger `enforce_plan_audience` is the real backstop (never
 * bypassable), but doing this check client-side first lets us show a much more
 * helpful message — especially for the very common "hasn't set gender yet" case,
 * which the DB trigger can't distinguish from "confirmed not a woman".
 */
export async function checkWomenOnlyGate(
  planAudience: string | null | undefined,
  userId: string
): Promise<boolean> {
  if (planAudience !== "women_only") return true;

  const { data } = await supabase
    .from("profiles")
    .select("gender")
    .eq("user_id", userId)
    .maybeSingle();

  const gender = (data as any)?.gender ?? null;

  if (gender === "woman") return true;

  if (gender === null) {
    toast.error("This plan is only for women", {
      description: "Add your gender in Profile > Edit Profile to see if it's for you.",
    });
  } else {
    toast.error("Hold on Tiger, this plan is only for women");
  }

  return false;
}
