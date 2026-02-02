import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const NEW_ACCOUNT_ONBOARDING_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export function useOnboarding(userId: string | undefined, userCreatedAt?: string) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only check onboarding if user is logged in
    if (!userId) {
      setShowOnboarding(false);
      setIsChecking(false);
      return;
    }

    // Only show onboarding immediately after signup (not on later logins)
    const isNewAccount = (() => {
      if (!userCreatedAt) return false;
      const createdAtMs = new Date(userCreatedAt).getTime();
      if (Number.isNaN(createdAtMs)) return false;
      return Date.now() - createdAtMs < NEW_ACCOUNT_ONBOARDING_WINDOW_MS;
    })();

    if (!isNewAccount) {
      setShowOnboarding(false);
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    const checkOnboardingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles_private")
          .select("onboarding_completed")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("Error checking onboarding status:", error);
          setShowOnboarding(false);
        } else if (data) {
          // Show onboarding only if not completed
          setShowOnboarding(!data.onboarding_completed);
        } else {
          // No profile yet - don't show onboarding (profile will be created during signup)
          setShowOnboarding(false);
        }
      } catch (err) {
        console.error("Failed to check onboarding:", err);
        setShowOnboarding(false);
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    checkOnboardingStatus();

    return () => {
      cancelled = true;
    };
  }, [userId, userCreatedAt]);

  const completeOnboarding = useCallback(async () => {
    if (!userId) {
      setShowOnboarding(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles_private")
        .update({ onboarding_completed: true })
        .eq("user_id", userId);

      if (error) {
        console.error("Error completing onboarding:", error);
      }
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    }

    setShowOnboarding(false);
  }, [userId]);

  const resetOnboarding = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles_private")
        .update({ onboarding_completed: false })
        .eq("user_id", userId);

      if (error) {
        console.error("Error resetting onboarding:", error);
        return;
      }

      setShowOnboarding(true);
    } catch (err) {
      console.error("Failed to reset onboarding:", err);
    }
  }, [userId]);

  return {
    showOnboarding,
    isChecking,
    completeOnboarding,
    resetOnboarding,
  };
}
