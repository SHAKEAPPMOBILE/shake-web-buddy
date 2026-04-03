import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferralTracking";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  isManualOverride: boolean;
  subscriptionEnd: string | null;
  didJustSignUp: boolean;
  sendEmailOtp: (email: string, purpose?: string) => Promise<{ error: Error | null }>;
  verifyEmailOtp: (email: string, token: string, purpose?: string) => Promise<{ error: Error | null; data?: any }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
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
      const { data: publicProfile, error: publicErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (publicErr) {
        logPostgrestError("AuthContext ensureProfilesExist profiles select", publicErr);
      }

      if (!publicProfile) {
        const { error: insertPublicErr } = await supabase.from("profiles").insert({
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
        if (insertPublicErr) {
          logPostgrestError("AuthContext ensureProfilesExist profiles insert", insertPublicErr);
        }
      }

      // Private profile — never throw; 400/missing columns must not break session or routes (e.g. event chat).
      let privateProfile: { id?: string } | null = null;
      try {
        const { data, error: privateProfileError } = await supabase
          .from("profiles_private")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (privateProfileError) {
          logPostgrestError("AuthContext ensureProfilesExist profiles_private select", privateProfileError);
          console.error(
            "[AuthContext] profiles_private select body (stringify)",
            JSON.stringify({
              message: privateProfileError.message,
              details: privateProfileError.details,
              hint: privateProfileError.hint,
              code: privateProfileError.code,
            }),
          );
        } else {
          privateProfile = data;
        }
      } catch (e) {
        console.error("[AuthContext] profiles_private select threw (ignored):", e);
      }

      if (!privateProfile) {
        try {
          const { error: insertPrivateErr } = await supabase.from("profiles_private").insert({
            user_id: currentUser.id,
            phone_number: (currentUser.phone as string | undefined) || null,
          });
          if (insertPrivateErr) {
            logPostgrestError("AuthContext ensureProfilesExist profiles_private insert", insertPrivateErr);
          }
        } catch (e) {
          console.error("[AuthContext] profiles_private insert threw (ignored):", e);
        }
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

  // User-friendly message for technical/network errors (App Store rejects raw "Load failed" / "Edge Function returned non-2xx")
  const toUserFriendlyAuthError = (raw: string, fallback: string): string => {
    const lower = (raw || "").toLowerCase();
    if (
      lower.includes("load failed") ||
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("edge function") ||
      lower.includes("non-2xx") ||
      lower.includes("network request failed")
    ) {
      return fallback;
    }
    return raw || fallback;
  };

  // Send magic link OTP via email using Supabase
  const sendEmailOtp = async (email: string, purpose = "login"): Promise<{ error: Error | null }> => {
    try {
      const redirectUrl = import.meta.env.DEV
        ? "http://localhost:5173/auth/callback"
        : "https://shake-web-app.netlify.app/auth/callback";

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
          data: { purpose },
        },
      });

      if (error) {
        let errorMsg = error.message || "Failed to send magic link";
        errorMsg = toUserFriendlyAuthError(errorMsg, "Unable to send magic link. Please check your connection and try again.");
        return { error: new Error(errorMsg) };
      }

      return { error: null };
    } catch (e: any) {
      const msg = toUserFriendlyAuthError(e?.message || "", "Unable to send magic link. Please check your connection and try again.");
      return { error: new Error(msg) };
    }
  };

  // Verify OTP token from magic link (called from auth callback)
  const verifyEmailOtp = async (
    email: string,
    token: string,
    purpose?: string
  ): Promise<{ error: Error | null; data?: any }> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token,
        type: "email",
      });

      if (error) {
        let errorMsg = error.message || "Verification failed";
        errorMsg = toUserFriendlyAuthError(errorMsg, "Verification failed. Please check your connection and try again.");
        return { error: new Error(errorMsg) };
      }

      return { error: null, data };
    } catch (e: any) {
      const msg = toUserFriendlyAuthError(e?.message || "", "Verification failed. Please check your connection and try again.");
      return { error: new Error(msg) };
    }
  };

  const signUpWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: import.meta.env.DEV
          ? "http://localhost:5173/auth/callback"
          : "https://shake-web-app.netlify.app/auth/callback",
      },
    });
    if (error) {
      const friendly = toUserFriendlyAuthError(
        error.message,
        "Unable to sign up. Please check your connection and try again."
      );
      return { error: new Error(friendly) };
    }
    return { error: null };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) {
      const friendly = toUserFriendlyAuthError(
        error.message,
        "Unable to sign in. Please check your connection and try again."
      );
      return { error: new Error(friendly) };
    }
    return { error: null };
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
        sendEmailOtp,
        verifyEmailOtp,
        signUpWithPassword,
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
