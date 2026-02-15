import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferralTracking";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  isManualOverride: boolean;
  subscriptionEnd: string | null;
  didJustSignUp: boolean;
  sendOtp: (phone: string, purpose?: string) => Promise<{ error: Error | null; verificationId?: string }>;
  verifyOtp: (phone: string, code: string, verificationId: string, options?: { purpose?: string; password?: string; name?: string }) => Promise<{ error: Error | null; data?: any }>;
  signInWithPassword: (phone: string, password: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [didJustSignUp, setDidJustSignUp] = useState(false);

  // New users can exist without rows in `profiles` / `profiles_private`.
  // Some parts of the app assume these rows exist; ensure they do right after login.
  const ensureProfilesExist = async (currentUser: User) => {
    try {
      // Public profile
      const { data: publicProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (!publicProfile) {
        await supabase.from("profiles").insert({
          user_id: currentUser.id,
          name:
            (currentUser.user_metadata?.name as string | undefined) ||
            (currentUser.user_metadata?.full_name as string | undefined) ||
            null,
          avatar_url:
            (currentUser.user_metadata?.avatar_url as string | undefined) ||
            (currentUser.user_metadata?.picture as string | undefined) ||
            null,
        });
      }

      // Private profile
      const { data: privateProfile } = await supabase
        .from("profiles_private")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (!privateProfile) {
        await supabase.from("profiles_private").insert({
          user_id: currentUser.id,
          phone_number: (currentUser.phone as string | undefined) || null,
        });
      }
    } catch (e) {
      // Never block app load on this; we just want best-effort stability.
      console.log("ensureProfilesExist failed:", e);
    }
  };

  // Process referral after signup - award points to the referrer
  const processReferral = async (newUserId: string) => {
    try {
      const referralCode = getStoredReferralCode();
      if (!referralCode) return;

      console.log("Processing referral code:", referralCode);

      // Find the referrer by their referral code
      const { data: referrer, error: referrerError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (referrerError || !referrer) {
        console.log("Referrer not found for code:", referralCode);
        clearStoredReferralCode();
        return;
      }

      // Don't allow self-referral
      if (referrer.user_id === newUserId) {
        console.log("Self-referral not allowed");
        clearStoredReferralCode();
        return;
      }

      // Check if this user was already referred
      const { data: existingReferral } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_user_id", newUserId)
        .maybeSingle();

      if (existingReferral) {
        console.log("User already has a referral");
        clearStoredReferralCode();
        return;
      }

      // Create the referral record
      const { error: insertError } = await supabase
        .from("referrals")
        .insert({
          referrer_user_id: referrer.user_id,
          referred_user_id: newUserId,
          points_awarded: 5,
        });

      if (insertError) {
        console.error("Failed to create referral:", insertError);
      } else {
        console.log("Referral created successfully! Referrer gets +5 points");
      }

      clearStoredReferralCode();
    } catch (e) {
      console.error("Error processing referral:", e);
      clearStoredReferralCode();
    }
  };

  const checkSubscription = async (currentSession?: Session | null) => {
    // Use passed session or fall back to state (for external calls)
    const activeSession = currentSession ?? session;
    
    // Check if user is authenticated AND has valid access token
    if (!activeSession?.user?.id || !activeSession?.access_token) {
      setIsPremium(false);
      setSubscriptionEnd(null);
      return;
    }

    try {
      // Verify session is still valid before calling
      const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !freshSession?.access_token) {
        console.log("No valid session for subscription check");
        setIsPremium(false);
        setIsManualOverride(false);
        setSubscriptionEnd(null);
        return;
      }

      // Pass the access token explicitly to ensure it's included in the request
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${freshSession.access_token}`,
        },
      });
      
      if (error) {
        // Handle auth-related errors silently - user just isn't premium
        const errorMessage = error.message || JSON.stringify(error);
        if (
          errorMessage.includes("Auth session missing") ||
          errorMessage.includes("session_not_found") ||
          errorMessage.includes("401") ||
          errorMessage.includes("403") ||
          errorMessage.includes("Authentication")
        ) {
          console.log("Session invalid for subscription check, treating as non-premium");
          setIsPremium(false);
          setIsManualOverride(false);
          setSubscriptionEnd(null);
          return;
        }
        console.error("Error checking subscription:", error);
        // Don't throw, just treat as not premium
        setIsPremium(false);
        setIsManualOverride(false);
        setSubscriptionEnd(null);
        return;
      }
      
      setIsPremium(data?.subscribed || false);
      setIsManualOverride(data?.is_override || false);
      setSubscriptionEnd(data?.subscription_end || null);
    } catch (error: any) {
      // Catch any unexpected errors and fail gracefully
      console.log("Subscription check failed, treating as non-premium:", error?.message || error);
      setIsPremium(false);
      setIsManualOverride(false);
      setSubscriptionEnd(null);
    }
  };

  useEffect(() => {

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);

      // Detect "just signed up" without relying on a SIGNED_UP event.
      // In this SDK, signup typically results in SIGNED_IN; we treat it as
      // "new account" only when the user's first sign-in timestamp matches
      // their creation timestamp (first-ever login).
      const maybeUser = currentSession?.user;
      const isFirstEverLogin =
        event === "SIGNED_IN" &&
        !!maybeUser?.created_at &&
        !!maybeUser?.last_sign_in_at &&
        maybeUser.created_at === maybeUser.last_sign_in_at;
      // IMPORTANT: we deliberately do NOT persist this across refreshes.
      setDidJustSignUp(isFirstEverLogin);

      if (currentSession?.user) {
        // Ensure required profile rows exist (avoids runtime crashes / 406s)
        setTimeout(() => {
          ensureProfilesExist(currentSession.user);
        }, 0);

        // Process any pending referral
        setTimeout(() => {
          processReferral(currentSession.user.id);
        }, 500); // Slight delay to ensure profile exists first
      }

      // Defer subscription check with the current session
      if (currentSession?.user) {
        setTimeout(() => {
          checkSubscription(currentSession);
        }, 0);
      } else {
        setIsPremium(false);
        setIsManualOverride(false);
        setSubscriptionEnd(null);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setIsLoading(false);

      // Restoring a session is not a signup flow.
      setDidJustSignUp(false);

      if (existingSession?.user) {
        setTimeout(() => {
          ensureProfilesExist(existingSession.user);
        }, 0);
        setTimeout(() => {
          checkSubscription(existingSession);
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh subscription status periodically
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription(session);
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [session]);

  // Send OTP via Bird WhatsApp
  const sendOtp = async (phone: string, purpose = "auth"): Promise<{ error: Error | null; verificationId?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("send-bird-otp", {
        body: { phone, purpose },
      });

      if (error) {
        // Try to extract error message from the response
        let errorMsg = error.message || "Failed to send code";
        try {
          const parsed = JSON.parse(error.message);
          if (parsed?.error) errorMsg = parsed.error;
        } catch {}
        return { error: new Error(errorMsg) };
      }

      return { error: null, verificationId: data?.verificationId };
    } catch (e: any) {
      return { error: new Error(e?.message || "Failed to send code") };
    }
  };

  // Verify OTP via Bird
  const verifyOtp = async (
    phone: string,
    code: string,
    verificationId: string,
    options?: { purpose?: string; password?: string; name?: string }
  ): Promise<{ error: Error | null; data?: any }> => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-bird-otp", {
        body: {
          phone,
          code,
          verificationId,
          purpose: options?.purpose || "login",
          password: options?.password || "",
          name: options?.name || "",
        },
      });

      if (error) {
        let errorMsg = error.message || "Verification failed";
        try {
          const parsed = JSON.parse(error.message);
          if (parsed?.error) errorMsg = parsed.error;
        } catch {}
        return { error: new Error(errorMsg) };
      }

      return { error: null, data };
    } catch (e: any) {
      return { error: new Error(e?.message || "Verification failed") };
    }
  };

  const signInWithPassword = async (phone: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log("Sign out error (session may be expired):", error);
    }
    setUser(null);
    setSession(null);
    setDidJustSignUp(false);
    setIsPremium(false);
    setIsManualOverride(false);
    setSubscriptionEnd(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isPremium,
        isManualOverride,
        subscriptionEnd,
        didJustSignUp,
        sendOtp,
        verifyOtp,
        signInWithPassword,
        updatePassword,
        signOut,
        checkSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
