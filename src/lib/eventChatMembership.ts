/**
 * Rules for event_chat_members access:
 * - If `expires_at` is null/empty, the member is not treated as expired (paid row is valid).
 * - If `paid_at` is present and not stale (24h grace), membership should remain accessible.
 * - Only when `expires_at` is set to a valid timestamp in the past and no paid grace applies is access denied.
 */

export function isEventChatMembershipExplicitlyExpired(
  m: { expires_at?: string | null; paid_at?: string | null } | null,
): boolean {
  const expires_at = m?.expires_at ?? null;
  const paid_at = m?.paid_at ?? null;

  if (paid_at?.trim()) {
    const parsedPaidAt = new Date(paid_at);
    if (!Number.isNaN(parsedPaidAt.getTime())) {
      const paidGraceMillis = 24 * 60 * 60 * 1000;
      const endOfPaidGrace = parsedPaidAt.getTime() + paidGraceMillis;
      if (endOfPaidGrace > Date.now()) {
        console.log("[expiry-check]", {
          expires_at,
          paid_at,
          result: false,
          reason: "paid_at_within_grace_period",
        });
        return false;
      }
    }
  }

  if (!expires_at?.trim()) {
    console.log("[expiry-check]", { expires_at, paid_at, result: false, reason: "no_expires_at" });
    return false;
  }

  const d = new Date(expires_at);
  if (Number.isNaN(d.getTime())) {
    console.log("[expiry-check]", { expires_at, paid_at, result: false, reason: "invalid_expires_at" });
    return false;
  }

  const result = d.getTime() <= Date.now();
  console.log("[expiry-check]", { expires_at, paid_at, result, reason: result ? "expires_at_in_past" : "still_valid" });
  return result;
}

/**
 * Countdown target and whether the interval may flip status to "expired".
 * When `expires_at` is unset, we never expire the chat from the timer alone.
 */
export function resolveEventChatAccessExpiryForUi(
  member: { expires_at?: string | null; paid_at?: string | null },
  computedExpiresAt: Date,
): { expiryForCountdown: Date; enforceTimerExpiry: boolean } {
  const expiresAt = member.expires_at?.trim();
  const paidAt = member.paid_at?.trim();

  if (expiresAt) {
    const expiresDate = new Date(expiresAt);
    if (!Number.isNaN(expiresDate.getTime())) {
      const expiresInPast = expiresDate.getTime() <= Date.now();
      if (expiresInPast && paidAt) {
        const paidDate = new Date(paidAt);
        if (!Number.isNaN(paidDate.getTime())) {
          const paidExpiry = new Date(paidDate.getTime() + 24 * 60 * 60 * 1000);
          return { expiryForCountdown: paidExpiry, enforceTimerExpiry: true };
        }
      }
      return { expiryForCountdown: expiresDate, enforceTimerExpiry: true };
    }
  }

  const now = Date.now();
  const paidT = member.paid_at ? new Date(member.paid_at).getTime() : NaN;
  const paidPlus24h = Number.isFinite(paidT) ? paidT + 24 * 60 * 60 * 1000 : now + 24 * 60 * 60 * 1000;
  const eventEnd = computedExpiresAt.getTime();
  const expiryForCountdown = new Date(Math.max(eventEnd, paidPlus24h, now + 60_000));

  return { expiryForCountdown, enforceTimerExpiry: false };
}

/** Row present and not explicitly expired by expires_at. */
export function eventChatMembershipGrantsAccess(m: { expires_at?: string | null } | null): boolean {
  return !!m && !isEventChatMembershipExplicitlyExpired(m);
}
