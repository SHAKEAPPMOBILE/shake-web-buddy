import { useEffect } from "react";

const REFERRAL_STORAGE_KEY = "shake_referral_code";

// Store referral code from URL when user visits
export function useReferralTracking() {
  useEffect(() => {
    // Check if the current path could be a referral code
    const path = window.location.pathname;
    const potentialCode = path.slice(1); // Remove leading slash
    
    // Only store if it looks like a referral code (has alphanumeric chars and dash)
    // and is not a known route
    const knownRoutes = [
      "auth", "profile", "admin", "welcome", 
      "privacy-policy", "terms-of-service", "community-guidelines",
      "subscription-success", ""
    ];
    
    if (
      potentialCode && 
      !knownRoutes.includes(potentialCode) &&
      /^[a-z0-9]+-[a-z0-9]+$/i.test(potentialCode)
    ) {
      // Store the referral code in localStorage
      localStorage.setItem(REFERRAL_STORAGE_KEY, potentialCode);
      console.log("Referral code stored:", potentialCode);
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
