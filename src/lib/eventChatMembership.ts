/**
 * Rules for event_chat_members access:
 * - Primary source of truth is `event_starts_at` (scheduled event start).
 * - Chat access expires 12h after `event_starts_at`, regardless of payment status.
 * - If `event_starts_at` is missing/invalid, fallback to `expires_at` when available.
 */

export function isEventChatMembershipExplicitlyExpired(
  m: { expires_at?: string | null; paid_at?: string | null; event_starts_at?: string | null } | null,
): boolean {
  const expires_at = m?.expires_at ?? null;
  const paid_at = m?.paid_at ?? null;
  const event_starts_at = m?.event_starts_at ?? null;

  if (event_starts_at?.trim()) {
    const start = new Date(event_starts_at);
    if (!Number.isNaN(start.getTime())) {
      const eventExpiry = new Date(start.getTime() + 12 * 60 * 60 * 1000);
      const result = eventExpiry.getTime() <= Date.now();
      console.log("[expiry-check]", {
        event_starts_at,
        expires_at,
        paid_at,
        event_expiry: eventExpiry.toISOString(),
        result,
        reason: result ? "event_start_plus_12h_in_past" : "event_start_plus_12h_still_valid",
      });
      return result;
    }
  }

  if (!expires_at?.trim()) {
    console.log("[expiry-check]", { event_starts_at, expires_at, paid_at, result: false, reason: "no_valid_event_start_and_no_expires_at" });
    return false;
  }

  const d = new Date(expires_at);
  if (Number.isNaN(d.getTime())) {
    console.log("[expiry-check]", { event_starts_at, expires_at, paid_at, result: false, reason: "invalid_expires_at" });
    return false;
  }

  const result = d.getTime() <= Date.now();
  console.log("[expiry-check]", { event_starts_at, expires_at, paid_at, result, reason: result ? "fallback_expires_at_in_past" : "fallback_expires_at_still_valid" });
  return result;
}

/**
 * Countdown target and whether the interval may flip status to "expired".
 * Prefer `event_starts_at + 12h`; fallback to `expires_at`; fallback to `computedExpiresAt`.
 */
export function resolveEventChatAccessExpiryForUi(
  member: { expires_at?: string | null; paid_at?: string | null; event_starts_at?: string | null },
  computedExpiresAt: Date,
): { expiryForCountdown: Date; enforceTimerExpiry: boolean } {
  const startsAt = member.event_starts_at?.trim();
  const expiresAt = member.expires_at?.trim();

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
export function eventChatMembershipGrantsAccess(m: { expires_at?: string | null; event_starts_at?: string | null } | null): boolean {
  return !!m && !isEventChatMembershipExplicitlyExpired(m);
}
