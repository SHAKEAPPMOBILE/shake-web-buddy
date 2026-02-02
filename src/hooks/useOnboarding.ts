import { useState, useEffect } from "react";

const ONBOARDING_KEY_PREFIX = "shake_onboarding_completed_";

export function useOnboarding(userId: string | undefined) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only check onboarding if user is logged in
    if (!userId) {
      setShowOnboarding(false);
      setIsChecking(false);
      return;
    }

    const key = `${ONBOARDING_KEY_PREFIX}${userId}`;
    const hasCompleted = localStorage.getItem(key);
    
    if (!hasCompleted) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
    setIsChecking(false);
  }, [userId]);

  const completeOnboarding = () => {
    if (userId) {
      const key = `${ONBOARDING_KEY_PREFIX}${userId}`;
      localStorage.setItem(key, "true");
    }
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    if (userId) {
      const key = `${ONBOARDING_KEY_PREFIX}${userId}`;
      localStorage.removeItem(key);
      setShowOnboarding(true);
    }
  };

  return {
    showOnboarding,
    isChecking,
    completeOnboarding,
    resetOnboarding,
  };
}
