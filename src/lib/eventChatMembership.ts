/**
 * Rules for event_chat_members access:
 * - Source of truth is `scheduled_for` (scheduled event time).
 * - Chat access expires 12h after `scheduled_for`, regardless of payment status.
 * - If `scheduled_for` is missing, fallback to `event_starts_at`, then `expires_at`.
 */

export function isEventChatMembershipExplicitlyExpired(
  m: { expires_at?: string | null; event_starts_at?: string | null; scheduled_for?: string | null } | null,
): boolean {
  const expires_at = m?.expires_at ?? null;
  // Only use expires_at for expiry check. Ignore scheduled_for if null.
  if (!expires_at?.trim()) {
    console.log("[expiry-check]", { expires_at, result: false, reason: "no_expires_at" });
    return false;
  }
  const d = new Date(expires_at);
  if (Number.isNaN(d.getTime())) {
    console.log("[expiry-check]", { expires_at, result: false, reason: "invalid_expires_at" });
    return false;
  }
  const isExpired = d.getTime() < Date.now();
  console.log("[expiry-check]", { expires_at, result: isExpired, reason: isExpired ? "expires_at_in_past" : "expires_at_in_future" });
  return isExpired;
}

/**
 * Countdown target and whether the interval may flip status to "expired".
 * Prefer `scheduled_for + 12h`; fallback to `event_starts_at + 12h`; fallback to `expires_at`; fallback to `computedExpiresAt`.
 */
export function resolveEventChatAccessExpiryForUi(
  member: { expires_at?: string | null; event_starts_at?: string | null; scheduled_for?: string | null },
  computedExpiresAt: Date,
): { expiryForCountdown: Date; enforceTimerExpiry: boolean } {
  const scheduledFor = member.scheduled_for?.trim();
  const startsAt = member.event_starts_at?.trim();
  const expiresAt = member.expires_at?.trim();

  if (scheduledFor) {
    const scheduledForDate = new Date(scheduledFor);
    if (!Number.isNaN(scheduledForDate.getTime())) {
      return {
        expiryForCountdown: new Date(scheduledForDate.getTime() + 12 * 60 * 60 * 1000),
        enforceTimerExpiry: true,
      };
    }
  }

  if (startsAt) {
    const startsDate = new Date(startsAt);
    if (!Number.isNaN(startsDate.getTime())) {
      return {
        expiryForCountdown: new Date(startsDate.getTime() + 12 * 60 * 60 * 1000),
        enforceTimerExpiry: true,
      };
    }
  }

  if (expiresAt) {
    const expiresDate = new Date(expiresAt);
    if (!Number.isNaN(expiresDate.getTime())) {
      return { expiryForCountdown: expiresDate, enforceTimerExpiry: true };
    }
  }

  return { expiryForCountdown: computedExpiresAt, enforceTimerExpiry: true };
}

/** Row present and not explicitly expired by expires_at. */
export function eventChatMembershipGrantsAccess(m: { expires_at?: string | null; event_starts_at?: string | null; scheduled_for?: string | null } | null): boolean {
  return !!m && !isEventChatMembershipExplicitlyExpired(m);
}
