import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

interface WelcomeBonusState {
  isComplete: boolean;
  isClaimed: boolean;
  isLoading: boolean;
  missingFields: string[];
  userName: string;
}

const CELEBRATION_MS = 3000;

interface UseWelcomeBonusOptions {
  /**
   * Whether this instance should trigger the automatic claim+celebration+push
   * when the profile becomes complete. Only one mounted instance app-wide
   * should have this on (WelcomeBonusWatcher) — other consumers (e.g.
   * PointsDashboard, which just displays isComplete/isClaimed) pass false so
   * they don't race the owner's claim_welcome_bonus RPC call.
   */
  autoClaim?: boolean;
}

export function useWelcomeBonus(userId: string | undefined, options: UseWelcomeBonusOptions = {}) {
  const { autoClaim = true } = options;
  const [state, setState] = useState<WelcomeBonusState>({
    isComplete: false,
    isClaimed: false,
    isLoading: true,
    missingFields: [],
    userName: "",
  });
  // Non-null for CELEBRATION_MS right after an automatic claim actually
  // awards points — lets any screen show a "+10 points" moment without
  // each one re-deriving "did this just happen" itself. Self-clearing so
  // a screen that mounts later (or re-checks completeness on a stale
  // "isClaimed" already true) never sees a stale celebration replay.
  const [justClaimedPoints, setJustClaimedPoints] = useState<number | null>(null);

  const checkProfileCompleteness = useCallback(async () => {
    if (!userId) {
      setState({ isComplete: false, isClaimed: false, isLoading: false, missingFields: [], userName: "" });
      return;
    }

    try {
      // Fetch both profiles
      const [{ data: profile, error: profileError }, { data: privateProfile, error: privateError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name, avatar_url, nationality, occupation")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("profiles_private")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

      if (profileError) logPostgrestError("useWelcomeBonus profiles select", profileError);
      if (privateError) logPostgrestError("useWelcomeBonus profiles_private select", privateError);

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
        userName: profile?.name?.trim() || "",
      });
    } catch (error) {
      console.error("Error checking profile completeness:", error);
      setState({ isComplete: false, isClaimed: false, isLoading: false, missingFields: [], userName: "" });
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
        // Fire-and-forget — a missed push shouldn't block the in-app
        // celebration, which is the primary way the user learns about this.
        supabase.functions
          .invoke("send-push-notification", {
            body: {
              to_user_id: userId,
              title: "🎉 Welcome Bonus unlocked!",
              body: "You just earned +10 points for completing your profile.",
            },
          })
          .catch((err) => console.error("Error sending welcome bonus push:", err));
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

  // Claim automatically the moment the profile becomes complete — no
  // manual "Claim +10" button. claim_welcome_bonus is idempotent
  // server-side (checks welcome_bonus_claimed itself, returns false if
  // already claimed), so it's safe to just try this whenever the
  // completeness check says isComplete && !isClaimed, from any screen.
  useEffect(() => {
    if (!autoClaim || state.isLoading || !state.isComplete || state.isClaimed) return;
    let cancelled = false;
    claimBonus().then((claimed) => {
      if (cancelled || !claimed) return;
      setJustClaimedPoints(10);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoClaim, state.isLoading, state.isComplete, state.isClaimed]);

  useEffect(() => {
    if (justClaimedPoints === null) return;
    const id = setTimeout(() => setJustClaimedPoints(null), CELEBRATION_MS);
    return () => clearTimeout(id);
  }, [justClaimedPoints]);

  return {
    ...state,
    claimBonus,
    refetch: checkProfileCompleteness,
    justClaimedPoints,
  };
}
