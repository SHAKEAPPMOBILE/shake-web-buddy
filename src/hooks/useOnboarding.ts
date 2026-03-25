import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

export function useOnboarding(userId: string | undefined, didJustSignUp: boolean) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only check onboarding if user is logged in
    if (!userId) {
      setShowOnboarding(false);
      setIsChecking(false);
      return;
    }

    // Only show onboarding right after a fresh signup flow.
    // IMPORTANT: do not show it on refresh, normal login, or session restore.
    if (!didJustSignUp) {
      setShowOnboarding(false);
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    const checkOnboardingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles_private")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          logPostgrestError("useOnboarding profiles_private select", error);
          setShowOnboarding(false);
        } else if (data) {
          if (typeof data.onboarding_completed === "boolean") {
            setShowOnboarding(!data.onboarding_completed);
          } else {
            setShowOnboarding(false);
          }
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
  }, [userId, didJustSignUp]);

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
        logPostgrestError("useOnboarding profiles_private update complete", error);
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
        logPostgrestError("useOnboarding profiles_private update reset", error);
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
