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

/**
 * Gate for joining a friends-only plan. Returns true if the join may proceed.
 * The Postgres trigger `enforce_plan_audience` is the real backstop — this
 * client-side check just avoids a failed insert round-trip and shows a
 * clear message instead of a raw DB error.
 */
export async function checkFriendsOnlyGate(
  planAudience: string | null | undefined,
  creatorId: string,
  userId: string
): Promise<boolean> {
  if (planAudience !== "friends_only") return true;
  if (creatorId === userId) return true;

  const { data } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${creatorId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${creatorId})`)
    .maybeSingle();

  if (data) return true;

  toast.error("This plan is only for the creator's friends", {
    description: "Add them as a friend from the Friends tab to join.",
  });
  return false;
}
