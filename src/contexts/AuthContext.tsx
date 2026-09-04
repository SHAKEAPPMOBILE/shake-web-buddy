import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferralTracking";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { isNativePlatform } from "@/lib/platform-utils";
import { getNextOccurrenceDate } from "@/data/activityTypes";

export type OtpResult = {
  success: boolean;
  retryable: boolean;
  message: string;
  /** True when the email already has an account — a login link was sent instead of a signup link */
  isExistingUser?: boolean;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  isManualOverride: boolean;
  subscriptionEnd: string | null;
  didJustSignUp: boolean;
  markJustSignedUp: () => void;
  sendEmailOtp: (email: string, purpose?: "signup", attemptNumber?: number) => Promise<OtpResult>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: Error | null; status?: number }>;
  verifyEmailOtp: (email: string, token: string, purpose?: string) => Promise<{ error: Error | null; data?: any }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  setIsPremium: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // MONETIZATION BYPASS (2026-06): RevenueCat IAP removed; Stripe web billing coming.
  // Default everyone to premium so no gate or paywall fires. Do NOT read this from
  // the server while the bypass is active — the check-subscription edge function still
  // reflects the old RevenueCat state.
  const [isPremium, setIsPremium] = useState(true);
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

      // Resolve the best available name from OAuth metadata only. Do NOT fall
      // back to the email prefix — a truthy name here makes hasName=true in
      // Auth.tsx's getProfileCompletionState and silently skips the onboarding
      // wizard for email/magic-link signups, who haven't chosen a name yet.
      const resolvedName =
        (currentUser.user_metadata?.name as string | undefined)?.trim() ||
        (currentUser.user_metadata?.full_name as string | undefined)?.trim() ||
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

  // If the user signed up via the marketing site, a row in `marketing_joins`
  // holds their requested activity_type and city. On first-ever login we
  // honour that by inserting them into `activity_joins` and cleaning up.
  const processMarketingJoin = async (currentUser: User) => {
    const email = currentUser.email?.toLowerCase().trim();
    if (!email) return;

    try {
      // 1. Look up a pending marketing_joins row for this email.
      const { data: marketingRow, error: lookupErr } = await supabase
        .from("marketing_joins")
        .select("id, activity_type, city")
        .eq("email", email)
        .maybeSingle();

      if (lookupErr) {
        logPostgrestError("AuthContext processMarketingJoin lookup", lookupErr);
        return;
      }
      if (!marketingRow) return; // No pending marketing join — nothing to do.

      const { id: marketingId, activity_type, city } = marketingRow;

      // 2. Check if user already has an active join for this activity (avoid duplicates).
      const { data: existingJoin } = await supabase
        .from("activity_joins")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("activity_type", activity_type)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!existingJoin) {
        // 3. Insert the activity_joins row using the same expiry logic as joinActivity.
        const nextOccurrence = getNextOccurrenceDate(activity_type);
        nextOccurrence.setUTCHours(23, 59, 59, 999);
        const expiresAt = nextOccurrence.toISOString();

        const { error: insertErr } = await supabase.from("activity_joins").insert({
          user_id: currentUser.id,
          activity_type,
          city,
          expires_at: expiresAt,
        });

        if (insertErr) {
          // 23505 = unique violation — already joined, safe to ignore.
          if (insertErr.code !== "23505") {
            logPostgrestError("AuthContext processMarketingJoin insert", insertErr);
            return; // Don't delete the marketing row if the insert failed.
          }
        }
      }

      // 4. Delete the marketing_joins row so it doesn't trigger again.
      const { error: deleteErr } = await supabase
        .from("marketing_joins")
        .delete()
        .eq("id", marketingId);

      if (deleteErr) {
        logPostgrestError("AuthContext processMarketingJoin delete", deleteErr);
      } else {
        console.log("[AuthContext] Marketing join processed and cleaned up", { activity_type, city });
      }
    } catch (e) {
      console.error("[AuthContext] processMarketingJoin threw (ignored):", e);
    }
  };

  const checkSubscription = async (currentSession?: Session | null) => {
    // MONETIZATION BYPASS (2026-06): skip RevenueCat / edge-function check entirely.
    // Everyone is premium until Stripe web billing is wired up.
    // Original implementation preserved below (commented) so it can be restored.
    setIsPremium(true);
    setIsManualOverride(false);
    return;

    /* --- original checkSubscription body (preserved for future restore) ---
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
    --- end original checkSubscription body --- */
  };

  useEffect(() => {
    const bootstrapTimeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    // Race guard: onAuthStateChange's initial callback and the explicit
    // getSession() call below both resolve asynchronously, in no guaranteed
    // order. If getSession() resolves second (common on a slow connection —
    // exactly when a just-confirmed signup is still loading), it used to
    // unconditionally stomp didJustSignUp back to false, yanking the user
    // out of onboarding mid-flow. Once something re-showed onboarding after
    // that, OnboardingScreens remounted and its local step state reset to
    // 0 — "answered all the questions, then it asked me all from the
    // beginning". Once the listener has already made a determination for
    // this session, getSession()'s callback defers to it instead of
    // guessing "restore" by default.
    let authStateChangeFired = false;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      authStateChangeFired = true;
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

        // On first-ever login, honour any marketing_joins pre-signup entry.
        if (isFirstEverLogin) {
          setTimeout(() => {
            processMarketingJoin(currentSession.user);
          }, 600); // After profile + referral are both underway
        }
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

        // Restoring a session is not a signup flow — but only assume that
        // if onAuthStateChange hasn't already made the real determination
        // for this session (see the race-guard comment above).
        if (!authStateChangeFired) {
          setDidJustSignUp(false);
        }

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

  // Email confirmation/reset links must resolve as an HTTPS Universal Link
  // (iOS) / App Link (Android) so tapping them in Mail opens the app
  // directly — a custom URL scheme here left users stranded in Safari after
  // confirming, since Mail/Safari only auto-hands off to the app for a
  // verified https domain (apple-app-site-association / assetlinks.json),
  // never for an arbitrary custom scheme. OAuth sign-in (Google/Apple) is a
  // different, working mechanism — that flow's own in-app browser session
  // captures the custom-scheme redirect itself, so it's untouched here.
  const authCallbackBaseUrl = isNativePlatform()
    ? "https://www.shakeapp.today/auth/callback"
    : import.meta.env.DEV
      ? "http://localhost:8080/auth/callback"
      : "https://www.shakeapp.today/auth/callback";

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

      // For signup (first attempt only): check if the account already exists by
      // calling signInWithOtp with shouldCreateUser: false.
      // - No error → user exists → a plain login link was sent; return success so the UI shows confirmation.
      // - Error → user doesn't exist (or rate-limit hit) → proceed to create.
      if (purpose === "signup" && attemptNumber === 1) {
        const { error: existsError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: {
            // Use base URL only (no ?intent=signup) so existing users are not routed
            // to the set-password screen — they should land on the app home.
            emailRedirectTo: authCallbackBaseUrl,
            shouldCreateUser: false,
          },
        });

        if (!existsError) {
          // User already has an account — a login magic link was just sent to them.
          console.log("[AuthContext][sendEmailOtp] User already exists — login link sent", {
            email: email.toLowerCase().trim(),
          });
          return {
            success: true,
            isExistingUser: true,
            retryable: false,
            message: "Check your email for a link to sign in",
          };
        }

        // Rate-limit from the existence check → propagate immediately.
        const existsCode = (existsError as any)?.code;
        const existsStatus = (existsError as any)?.status;
        const existsLower = (existsError.message || "").toLowerCase();
        if (
          existsCode === "over_email_send_rate_limit" ||
          existsStatus === 429 ||
          existsLower.includes("too many")
        ) {
          const waitSecondsMatch = (existsError.message || "").match(/after\s+(\d+)\s+seconds?/i);
          const waitSeconds = waitSecondsMatch?.[1] ? Number(waitSecondsMatch[1]) : null;
          return {
            success: false,
            retryable: false,
            message: waitSeconds && Number.isFinite(waitSeconds)
              ? `Please wait ${waitSeconds} seconds before trying again.`
              : "Too many attempts. Please wait a minute and try again.",
          };
        }

        // Any other error (user_not_found, email_not_confirmed, etc.) means the
        // user doesn't exist yet — fall through to create them below.
      }

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
    // Use raw fetch so we get the true HTTP status. supabase-js v2 swallows 429
    // responses from /auth/v1/recover and returns {error:null}, which would cause
    // the success confirmation screen to show even when the request failed.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    // redirect_to must be a query param, not a body field — GoTrue's /recover
    // endpoint only reads it off the URL (see auth-js lib/fetch.js _request()).
    const redirectTo = `${authCallbackBaseUrl}?intent=reset`;
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          gotrue_meta_security: {},
        }),
      });
    } catch {
      return {
        error: new Error("Unable to send password reset email. Please check your connection and try again."),
        status: 0,
      };
    }
    if (!res.ok) {
      return { error: new Error(res.status === 429 ? "rate_limited" : "request_failed"), status: res.status };
    }
    return { error: null, status: res.status };
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

  // Called once, right when the signup wizard's "Complete Setup" succeeds, so
  // useOnboarding knows to show the post-signup app-tour screens. Without this
  // being set, didJustSignUp stays false forever and the tour never shows.
  const markJustSignedUp = () => {
    setDidJustSignUp(true);
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
        markJustSignedUp,
        sendEmailOtp,
        sendPasswordResetEmail,
        verifyEmailOtp,
        signUpWithPassword,
        signInWithPassword,
        updatePassword,
        signOut,
        checkSubscription,
        setIsPremium,
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
