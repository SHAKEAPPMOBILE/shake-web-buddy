import { supabase } from "@/integrations/supabase/client";
import { getNextOccurrenceDate } from "@/data/activityTypes";

/** Maximum number of active members allowed in a single group chat. */
export const MAX_GROUP_CAPACITY = 7;

/** 24-hour window: plans scheduled more than this far in the past are considered stale. */
const STALE_MS = 24 * 60 * 60 * 1000;

export interface ActivityGroupRow {
  id: string;
  activity_type: string;
  city: string;
  user_id: string;
  scheduled_for: string | null;
  group_number: number | null;
  is_auto_generated: boolean | null;
  note: string | null;
  is_active: boolean;
}

/**
 * Find an existing group with available capacity (< MAX_GROUP_CAPACITY active joins)
 * for the given activityType + city, or create a new overflow group.
 *
 * Works from activityType + city alone — no plan object required.
 * Callers: useActivityJoins (carousel), PlansTab (My City cards).
 *
 * Logic:
 *  1. Fetch all active plans for this type+city, ordered by scheduled_for ASC.
 *  2. Apply the 24-h stale cutoff in JS (PostgREST .or() with ISO timestamps is unreliable).
 *  3. Collect all plans with count < MAX_GROUP_CAPACITY ("open groups").
 *  4. If only one open group → return it immediately (no scoring overhead).
 *  5. If multiple open groups → score by Jaccard interest overlap between the
 *     joining user and each group's current members; return the best match.
 *     Scoring is skipped entirely when the user has no saved interests, or when
 *     all candidate groups are empty — falling back to oldest-first.
 *  6. If no open group found → create a new overflow group.
 *
 * No toasts — callers decide what to tell the user.
 *
 * Returns null only if the DB insert fails.
 */
export async function findOrCreateOpenGroup(
  activityType: string,
  city: string,
  userId: string,
): Promise<ActivityGroupRow | null> {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  // Fetch all current active plans for this type+city, oldest first (fill early groups first).
  const { data: plans } = await supabase
    .from("user_activities")
    .select("id, activity_type, city, user_id, scheduled_for, group_number, is_auto_generated, note, is_active")
    .eq("activity_type", activityType)
    .eq("city", city)
    .eq("is_active", true)
    .order("scheduled_for", { ascending: true });

  // Apply the 24-h cutoff in JS — PostgREST .or() with ISO timestamps silently mis-parses.
  const currentPlans: ActivityGroupRow[] = ((plans ?? []) as ActivityGroupRow[]).filter(
    (p) => p.scheduled_for == null || p.scheduled_for >= cutoff,
  );

  // Collect ALL open groups (has room) — we need to compare them for scoring.
  const openGroups: Array<{ plan: ActivityGroupRow; memberIds: string[] }> = [];

  for (const plan of currentPlans) {
    const { data: activeJoins } = await supabase
      .from("activity_joins")
      .select("id, user_id")
      .eq("activity_id", plan.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    const memberIds: string[] = (activeJoins ?? [])
      .map((j: any) => j.user_id as string)
      .filter(Boolean);

    if (memberIds.length < MAX_GROUP_CAPACITY) {
      openGroups.push({ plan, memberIds });
    }
  }

  if (openGroups.length === 1) {
    // Only one option — skip scoring entirely.
    return openGroups[0].plan;
  }

  if (openGroups.length > 1) {
    // Multiple open groups — score by Jaccard interest overlap.
    const bestPlan = await pickByInterestJaccard(userId, openGroups);
    return bestPlan;
  }

  // No open group found — create a new overflow group.
  const freshScheduledFor = getNextOccurrenceDate(activityType).toISOString();

  const maxGroupNum = currentPlans.length > 0
    ? Math.max(...currentPlans.map((p) => p.group_number ?? 1))
    : 1;
  const nextGroupNumber = maxGroupNum + 1;

  const { data: newPlan, error } = await supabase
    .from("user_activities")
    .insert({
      user_id: userId,
      activity_type: activityType,
      city,
      scheduled_for: freshScheduledFor,
      is_active: true,
      is_auto_generated: true,
      group_number: nextGroupNumber,
    })
    .select("id, activity_type, city, user_id, scheduled_for, group_number, is_auto_generated, note, is_active")
    .single();

  if (error || !newPlan) {
    console.error("[activityGroups] Failed to create overflow group:", error);
    return null;
  }

  return newPlan as ActivityGroupRow;
}

// ── Jaccard interest scoring ──────────────────────────────────────────────────

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|.
 * Returns 0 when both sets are empty (no overlap to exploit).
 */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const intersection = b.filter((x) => setA.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Given multiple open groups, pick the one whose existing members have the
 * highest average Jaccard overlap with the joining user's interests.
 *
 * Falls back to the first group (oldest-first order) when:
 *  - The joining user has no saved interests.
 *  - All candidate groups are empty (no members yet to compare against).
 *  - The DB query for interests fails.
 */
async function pickByInterestJaccard(
  userId: string,
  openGroups: Array<{ plan: ActivityGroupRow; memberIds: string[] }>,
): Promise<ActivityGroupRow> {
  // Fetch joining user's interests.
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("interests")
    .eq("user_id", userId)
    .maybeSingle();

  const userInterests: string[] = userProfile?.interests ?? [];

  // No interests saved — fall back to oldest-first.
  if (userInterests.length === 0) return openGroups[0].plan;

  // Fetch interests for ALL group members in one query.
  const allMemberIds = [...new Set(openGroups.flatMap((g) => g.memberIds))];

  // All groups are empty — no one to compare against; fall back.
  if (allMemberIds.length === 0) return openGroups[0].plan;

  const { data: memberProfiles } = await supabase
    .from("profiles")
    .select("user_id, interests")
    .in("user_id", allMemberIds);

  const interestsByUserId = new Map<string, string[]>(
    (memberProfiles ?? []).map((p: any) => [p.user_id as string, (p.interests as string[]) ?? []])
  );

  // Score each group by average Jaccard similarity to the joining user.
  let bestPlan = openGroups[0].plan;
  let bestScore = -1;

  for (const { plan, memberIds } of openGroups) {
    if (memberIds.length === 0) {
      // Empty group: treat as score 0 (prefer non-empty groups with overlap).
      if (bestScore < 0) { bestPlan = plan; bestScore = 0; }
      continue;
    }

    const scores = memberIds.map((id) =>
      jaccard(userInterests, interestsByUserId.get(id) ?? [])
    );
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avg > bestScore) {
      bestScore = avg;
      bestPlan = plan;
    }
  }

  return bestPlan;
}
