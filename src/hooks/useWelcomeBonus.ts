import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WelcomeBonusState {
  isComplete: boolean;
  isClaimed: boolean;
  isLoading: boolean;
  missingFields: string[];
}

export function useWelcomeBonus(userId: string | undefined) {
  const [state, setState] = useState<WelcomeBonusState>({
    isComplete: false,
    isClaimed: false,
    isLoading: true,
    missingFields: [],
  });

  const checkProfileCompleteness = useCallback(async () => {
    if (!userId) {
      setState({ isComplete: false, isClaimed: false, isLoading: false, missingFields: [] });
      return;
    }

    try {
      // Fetch both profiles
      const [{ data: profile }, { data: privateProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, avatar_url, nationality, occupation")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles_private")
          .select("date_of_birth, billing_email, welcome_bonus_claimed")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const missing: string[] = [];
      
      // Check public profile fields
      if (!profile?.name?.trim()) missing.push("Name");
      if (!profile?.avatar_url?.trim()) missing.push("Profile picture");
      if (!profile?.nationality?.trim()) missing.push("Nationality");
      if (!profile?.occupation?.trim()) missing.push("Occupation");
      
      // Check private profile fields
      if (!privateProfile?.date_of_birth) missing.push("Date of birth");
      if (!privateProfile?.billing_email?.trim()) missing.push("Email");

      setState({
        isComplete: missing.length === 0,
        isClaimed: privateProfile?.welcome_bonus_claimed || false,
        isLoading: false,
        missingFields: missing,
      });
    } catch (error) {
      console.error("Error checking profile completeness:", error);
      setState({ isComplete: false, isClaimed: false, isLoading: false, missingFields: [] });
    }
  }, [userId]);

  const claimBonus = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase.rpc("claim_welcome_bonus", {
        target_user_id: userId,
      });

      if (error) {
        console.error("Error claiming welcome bonus:", error);
        return false;
      }

      if (data) {
        setState((prev) => ({ ...prev, isClaimed: true }));
      }

      return data || false;
    } catch (error) {
      console.error("Error claiming welcome bonus:", error);
      return false;
    }
  }, [userId]);

  useEffect(() => {
    checkProfileCompleteness();
  }, [checkProfileCompleteness]);

  return {
    ...state,
    claimBonus,
    refetch: checkProfileCompleteness,
  };
}
