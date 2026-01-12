import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPremium: boolean;
  subscriptionEnd: string | null;
  signUpWithPhone: (phone: string, name: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

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
          setSubscriptionEnd(null);
          return;
        }
        console.error("Error checking subscription:", error);
        // Don't throw, just treat as not premium
        setIsPremium(false);
        setSubscriptionEnd(null);
        return;
      }
      
      setIsPremium(data?.subscribed || false);
      setSubscriptionEnd(data?.subscription_end || null);
    } catch (error: any) {
      // Catch any unexpected errors and fail gracefully
      console.log("Subscription check failed, treating as non-premium:", error?.message || error);
      setIsPremium(false);
      setSubscriptionEnd(null);
    }
  };

  useEffect(() => {
    let urlOpenListener: any = null;

    // Native (Capacitor) OAuth: catch the deep link and exchange the code for a session
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appUrlOpen", async ({ url }) => {
        if (!url) return;
        if (!url.startsWith("shake://auth/callback")) return;

        // Close the in-app browser and finish the auth exchange
        try {
          await Browser.close();
        } catch {
          // ignore
        }

        try {
          await supabase.auth.exchangeCodeForSession(url);
        } catch {
          console.log("OAuth code exchange failed");
        }
      }).then((handle) => {
        urlOpenListener = handle;
      });
    }

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);

      // Defer subscription check with the current session
      if (currentSession?.user) {
        setTimeout(() => {
          checkSubscription(currentSession);
        }, 0);
      } else {
        setIsPremium(false);
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
          checkSubscription(existingSession);
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      urlOpenListener?.remove();
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

  const signInWithGoogle = async () => {
    // Web: browser redirect back to current origin
    // Native: use deep link + exchangeCodeForSession via appUrlOpen listener
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "shake://auth/callback",
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) return { error: error as Error | null };

      if (data?.url) {
        await Browser.open({ url: data.url });
      }

      return { error: null };
    }

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: "select_account",
        },
      },
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
    setSubscriptionEnd(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isPremium,
        subscriptionEnd,
        signUpWithPhone,
        signInWithPhone,
        signInWithPassword,
        signInWithGoogle,
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
