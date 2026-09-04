import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const REFERRAL_STORAGE_KEY = "shake_referral_code";
const SESSION_KEY_STORAGE_KEY = "shake_referral_session_key";
const CLICK_LOGGED_PREFIX = "shake_referral_click_logged:";

// One random key per browser tab session (sessionStorage, not localStorage —
// it must NOT survive a closed tab, that's what makes it "session-scoped").
function getOrCreateSessionKey(): string {
  let key = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, key);
  }
  return key;
}

// Funnel-visibility only — logs that this code was visited, separate from
// the referrals table (which only ever records a completed signup). Fire-
// and-forget: never blocks rendering, never throws. Gated client-side to
// once per code+session; the DB's unique(referral_code, session_key)
// constraint is the backstop if this ever fires twice.
function logReferralClick(code: string) {
  const flagKey = `${CLICK_LOGGED_PREFIX}${code}`;
  if (sessionStorage.getItem(flagKey)) return;
  sessionStorage.setItem(flagKey, "1");

  supabase
    .from("referral_clicks")
    .insert({ referral_code: code, session_key: getOrCreateSessionKey() })
    .then(({ error }) => {
      if (error) console.log("[useReferralTracking] click log failed (non-blocking):", error.message);
    });
}

// Store referral code from URL when user visits
export function useReferralTracking() {
  useEffect(() => {
    // Check if the current path could be a referral code
    const path = window.location.pathname;
    const potentialCode = path.slice(1); // Remove leading slash

    // Only store if it looks like a referral code (has alphanumeric chars and dash)
    // and is not a known route
    // Kept in sync with App.tsx's KNOWN_ROUTES — a route missing from this
    // list gets misfiled as a referral code (harmless: it just never
    // matches a real profile and gets cleared on the next processReferral
    // pass, but it's still worth keeping these in sync).
    const knownRoutes = [
      "auth", "profile", "admin", "welcome",
      "privacy-policy", "terms-of-service", "community-guidelines",
      "subscription-success", "propose-plan", "plans",
      "chat", "events", "home", "invite", "guest", ""
    ];

    if (
      potentialCode &&
      !knownRoutes.includes(potentialCode) &&
      /^[a-z0-9]+-[a-z0-9]+$/i.test(potentialCode)
    ) {
      // Store the referral code in localStorage
      localStorage.setItem(REFERRAL_STORAGE_KEY, potentialCode);
      console.log("Referral code stored:", potentialCode);
      logReferralClick(potentialCode);
    }
  }, []);
}

// Get stored referral code
export function getStoredReferralCode(): string | null {
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

// Clear stored referral code after successful signup
export function clearStoredReferralCode(): void {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
