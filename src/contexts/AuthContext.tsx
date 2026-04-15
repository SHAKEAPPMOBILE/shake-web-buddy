import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferralTracking";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

export type OtpResult = {
  success: boolean;
  retryable: boolean;
  message: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  isManualOverride: boolean;
  subscriptionEnd: string | null;
  didJustSignUp: boolean;
  sendEmailOtp: (email: string, purpose?: "signup", attemptNumber?: number) => Promise<OtpResult>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: Error | null }>;
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
        .select("id, name, avatar_url")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (publicErr) {
        logPostgrestError("AuthContext ensureProfilesExist profiles select", publicErr);
      }

      // Resolve the best available name from OAuth metadata, falling back to
      // the email prefix so the profile is never stored with name = null.
      const resolvedName =
        (currentUser.user_metadata?.name as string | undefined)?.trim() ||
        (currentUser.user_metadata?.full_name as string | undefined)?.trim() ||
        currentUser.email?.split("@")[0]?.trim() ||
        null;

      const resolvedAvatarUrl =
        (currentUser.user_metadata?.picture as string | undefined) ||
        (currentUser.user_metadata?.avatar_url as string | undefined) ||
        null;

      if (!publicProfile) {
        // No row yet — insert with the best values we have.
        const { error: insertPublicErr } = await supabase.from("profiles").insert({
          user_id: currentUser.id,
          name: resolvedName,
          avatar_url: resolvedAvatarUrl,
        });
        if (insertPublicErr) {
          logPostgrestError("AuthContext ensureProfilesExist profiles insert", insertPublicErr);
        }
      } else {
        // Row exists — backfill any columns that are currently NULL without
        // touching values the user has already set.
        const needsNameBackfill = !publicProfile.name?.trim() && !!resolvedName;
        const needsAvatarBackfill = !publicProfile.avatar_url && !!resolvedAvatarUrl;

        if (needsNameBackfill || needsAvatarBackfill) {
          const patch: Record<string, string> = {};
          if (needsNameBackfill) patch.name = resolvedName!;
          if (needsAvatarBackfill) patch.avatar_url = resolvedAvatarUrl!;

          const { error: backfillErr } = await supabase
            .from("profiles")
            .update(patch)
            .eq("user_id", currentUser.id);
          if (backfillErr) {
            logPostgrestError("AuthContext ensureProfilesExist profiles backfill", backfillErr);
          }
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
      const { data: existingReferral, error: existingReferralError } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_user_id", newUserId)
        .maybeSingle();

      if (existingReferralError) {
        logPostgrestError("AuthContext processReferral existing referral select", existingReferralError);
      }

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
    const bootstrapTimeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 3000);

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
    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession }, error: existingSessionError }) => {
        if (existingSessionError) {
          console.warn("[AuthContext] getSession during bootstrap failed; continuing unauthenticated", existingSessionError.message);
        }

        setSession(existingSession ?? null);
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
      })
      .catch((error) => {
        console.warn("[AuthContext] getSession bootstrap threw; continuing unauthenticated", error);
        setSession(null);
        setUser(null);
        setIsLoading(false);
        setDidJustSignUp(false);
      });

    return () => {
      window.clearTimeout(bootstrapTimeoutId);
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

  const authCallbackBaseUrl = import.meta.env.DEV
    ? "http://localhost:8080/auth/callback"
    : "https://app.shakeapp.today/auth/callback";

  // Signup magic link uses `?intent=signup` so OAuthCallback can route to set-password.
  // Add the full URL with query to Supabase Auth → Redirect URLs if your project requires exact matches.

  // Send magic link OTP via email using Supabase (signup only in UI — login uses password)
  const sendEmailOtp = async (email: string, purpose: "signup" = "signup", attemptNumber = 1): Promise<OtpResult> => {
    try {
      const redirectUrl =
        purpose === "signup" ? `${authCallbackBaseUrl}?intent=signup` : authCallbackBaseUrl;

      console.log("[AuthContext][sendEmailOtp] Initiating magic link send", {
        email: email.toLowerCase().trim(),
        purpose,
        redirectUrl,
        timestamp: new Date().toISOString(),
        attempt: attemptNumber,
      });

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (error) {
        // Log the full error with code, message, and status for debugging
        console.error("[AuthContext][sendEmailOtp] Supabase error", {
          code: (error as any)?.code,
          message: error.message,
          status: (error as any)?.status,
          timestamp: new Date().toISOString(),
          attempt: attemptNumber,
        });

        const errorCode = (error as any)?.code;
        const errorStatus = (error as any)?.status;
        const lower = (error.message || "").toLowerCase();

        // ONLY retry for otp_disabled, never for rate limits
        const isRetryable = errorCode === "otp_disabled" || lower.includes("otp_disabled");

        if (isRetryable && attemptNumber === 1) {
          console.log("[AuthContext][sendEmailOtp] Retryable error detected, will retry after 3 seconds", {
            code: errorCode,
            status: errorStatus,
          });
          // Return retryable result
          return {
            success: false,
            retryable: true,
            message: "Temporarily unavailable. Retrying...",
          };
        }

        // Generate user-facing error messages based on error type
        let errorMsg = error.message || "Failed to send magic link";

        if (lower.includes("otp_disabled")) {
          errorMsg = "Email login is temporarily unavailable. Please try again shortly or use another sign-in method.";
        } else if (
          errorCode === "over_email_send_rate_limit" ||
          errorStatus === 429 ||
          lower.includes("too many")
        ) {
          const waitSecondsMatch = (error.message || "").match(/after\s+(\d+)\s+seconds?/i);
          const waitSeconds = waitSecondsMatch?.[1] ? Number(waitSecondsMatch[1]) : null;
          errorMsg = waitSeconds && Number.isFinite(waitSeconds)
            ? `Please wait ${waitSeconds} seconds before trying again.`
            : "Too many attempts. Please wait a minute and try again.";
        } else if (lower.includes("signups not allowed") || errorCode === "signup_disabled") {
          errorMsg = "Signups are currently disabled. Please contact support.";
        } else if (errorCode === "email_address_not_authorized") {
          errorMsg =
            "This email is not allowed to sign in (project email rules). Try another address or ask an admin to allow it in Supabase.";
        } else if (errorCode === "email_address_invalid") {
          errorMsg = "This email address looks invalid to the server. Check for typos.";
        } else if (
          errorCode === "user_not_found" ||
          errorCode === "invalid_credentials" ||
          errorCode === "identity_not_found" ||
          lower.includes("user not found")
        ) {
          errorMsg = "Failed to send verification link. Please try again.";
        } else if (
          lower.includes("duplicate key") ||
          lower.includes("users_email_partial_key") ||
          lower.includes("already registered")
        ) {
          errorMsg = "An account with this email already exists. Please sign in instead.";
        } else if (lower.includes("network") || lower.includes("failed to fetch")) {
          errorMsg = "Connection issue. Check your internet and try again.";
        } else {
          // Generic error with code for support purposes
          const code = errorCode || "UNKNOWN";
          errorMsg = `Something went wrong. Error: ${code}. Please check your connection and try again.`;
          errorMsg = toUserFriendlyAuthError(errorMsg, "Unable to send magic link. Please check your connection and try again.");
        }

        return {
          success: false,
          retryable: false,
          message: errorMsg,
        };
      }

      console.log("[AuthContext][sendEmailOtp] Magic link sent successfully", {
        email: email.toLowerCase().trim(),
        timestamp: new Date().toISOString(),
      });
      return {
        success: true,
        retryable: false,
        message: "Magic link sent successfully",
      };
    } catch (e: any) {
      console.error("[AuthContext][sendEmailOtp] Exception thrown", {
        message: e?.message,
        name: e?.name,
        timestamp: new Date().toISOString(),
        attempt: attemptNumber,
      });

      const msg = toUserFriendlyAuthError(
        e?.message || "",
        "Unable to send magic link. Please check your connection and try again."
      );
      return {
        success: false,
        retryable: false,
        message: msg,
      };
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
        emailRedirectTo: authCallbackBaseUrl,
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

  const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${authCallbackBaseUrl}?intent=reset`,
    });
    if (error) {
      const friendly = toUserFriendlyAuthError(
        error.message,
        "Unable to send password reset email. Please check your connection and try again."
      );
      return { error: new Error(friendly) };
    }
    return { error: null };
  };

  /** Sets password on the current session (e.g. after email magic-link signup). Merges `password_set_at` into user_metadata. */
  const updatePassword = async (password: string) => {
    const { data: { user: u } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        ...(u?.user_metadata ?? {}),
        password_set_at: new Date().toISOString(),
      },
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
        sendPasswordResetEmail,
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
