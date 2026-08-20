import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { InAppReview } from "@capacitor-community/in-app-review";

const OPEN_COUNT_KEY = "shake_open_count";
const REVIEW_REQUESTED_KEY = "shake_review_requested";
const TARGET_LAUNCH = 3;

/**
 * Increments the app-open counter and requests an in-app review on the 3rd
 * ELIGIBLE launch. Never requests more than once (guarded by
 * shake_review_requested). OS decides whether to actually show the dialog.
 *
 * `enabled` must be false while the user is logged out or still going
 * through onboarding — Apple rejected an earlier build (Guideline 5.6.3)
 * for prompting before the user had a chance to see the app's value.
 * Launches during that window must not count at all, not just skip the
 * prompt, otherwise a user who backgrounds the app a few times mid-signup
 * (e.g. to read a verification code) can still hit the 3rd-launch trigger
 * before onboarding is even done.
 */
export function useReviewPrompt(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    // Only on native — the plugin stubs throw on web
    if (!Capacitor.isNativePlatform()) return;

    try {
      const alreadyRequested =
        localStorage.getItem(REVIEW_REQUESTED_KEY) === "true";
      if (alreadyRequested) return;

      const raw = localStorage.getItem(OPEN_COUNT_KEY);
      const count = raw ? parseInt(raw, 10) : 0;
      const newCount = count + 1;
      localStorage.setItem(OPEN_COUNT_KEY, String(newCount));

      if (newCount === TARGET_LAUNCH) {
        localStorage.setItem(REVIEW_REQUESTED_KEY, "true");
        InAppReview.requestReview()
          .then(() => console.log("[ReviewPrompt] requestReview called"))
          .catch((err) => console.warn("[ReviewPrompt] requestReview failed", err));
      }
    } catch (err) {
      // localStorage or plugin unavailable — silently skip
      console.warn("[ReviewPrompt] error", err);
    }
  }, [enabled]);
}
