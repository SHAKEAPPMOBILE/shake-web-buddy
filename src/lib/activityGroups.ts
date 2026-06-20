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
 *  3. Return the first plan with count < MAX_GROUP_CAPACITY.
 *  4. If none found, create a new group with group_number = max + 1, is_auto_generated = true.
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

  // Return the first plan that still has room.
  for (const plan of currentPlans) {
    const { data: activeJoins } = await supabase
      .from("activity_joins")
      .select("id")
      .eq("activity_id", plan.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    const count = activeJoins?.length ?? 0;
    if (count < MAX_GROUP_CAPACITY) {
      return plan;
    }
  }

  // No current plan with room — create a new overflow group.
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
