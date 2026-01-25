import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  isManualOverride: boolean;
  subscriptionEnd: string | null;
  signUpWithPhone: (phone: string, name: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPasswordWithEmail: (email: string) => Promise<{ error: Error | null }>;
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

      if (currentSession?.user) {
        // Ensure required profile rows exist (avoids runtime crashes / 406s)
        setTimeout(() => {
          ensureProfilesExist(currentSession.user);
        }, 0);
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

  const signUpWithPhone = async (phone: string, name: string) => {
    // Send OTP to phone number for signup
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: {
          phone_number: phone,
          name: name,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signInWithPhone = async (phone: string) => {
    // Send OTP to phone number for login
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error: error as Error | null };
  };

  const signInWithPassword = async (phone: string, password: string) => {
    // Sign in with phone + password
    const { error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    // Update user's password (used after OTP verification for password reset)
    const { error } = await supabase.auth.updateUser({
      password,
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { error: error as Error | null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const resetPasswordWithEmail = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };


  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Session might already be expired, clear local state anyway
      console.log("Sign out error (session may be expired):", error);
    }
    // Always clear local state regardless of server response
    setUser(null);
    setSession(null);
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
        signUpWithPhone,
        signInWithPhone,
        signInWithPassword,
        signUpWithEmail,
        signInWithEmail,
        resetPasswordWithEmail,
        updatePassword,
        verifyOtp,
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
