/**
 * Rules for event_chat_members access:
 * - If `paid_at` exists (any value, no time window), membership is always active.
 * - Only when `expires_at` is set to a valid timestamp in the past AND no paid_at, access is denied.
 */

export function isEventChatMembershipExplicitlyExpired(
  m: { expires_at?: string | null; paid_at?: string | null } | null,
): boolean {
  const expires_at = m?.expires_at ?? null;
  const paid_at = m?.paid_at ?? null;

  if (paid_at?.trim()) {
    console.log("[expiry-check]", {
      expires_at,
      paid_at,
      result: false,
      reason: "paid_at_present_always_active",
    });
    return false;
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
 * When `paid_at` exists and `expires_at` is in the past, use paid_at + 24h (or now + 24h if that's later).
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
          const paidExpiry = paidDate.getTime() + 24 * 60 * 60 * 1000;
          const nowPlus24h = Date.now() + 24 * 60 * 60 * 1000;
          const expiryForCountdown = new Date(Math.max(paidExpiry, nowPlus24h));
          return { expiryForCountdown, enforceTimerExpiry: true };
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
