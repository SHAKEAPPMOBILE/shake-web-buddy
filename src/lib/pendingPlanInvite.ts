// Remembers "the plan someone was emailed an invite to" across the
// signup/login flow — same storage pattern as useReferralTracking's
// referral-code handling, just for a different piece of state.
const PENDING_INVITE_KEY = "shake_pending_plan_invite";

export function storePendingPlanInvite(activityId: string): void {
  localStorage.setItem(PENDING_INVITE_KEY, activityId);
}

export function getPendingPlanInvite(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY);
}

export function clearPendingPlanInvite(): void {
  localStorage.removeItem(PENDING_INVITE_KEY);
}
