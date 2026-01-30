import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface StripeConnectState {
  isConnected: boolean;
  status: "pending" | "complete" | "verification_pending" | null;
  email: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useStripeConnect() {
  const { user } = useAuth();
  const [state, setState] = useState<StripeConnectState>({
    isConnected: false,
    status: null,
    email: null,
    isLoading: false,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke("check-connect-status");
      
      if (error) throw error;

      setState({
        isConnected: data?.connected || false,
        status: data?.status || null,
        email: data?.email || null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error checking Stripe Connect status:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [user]);

  /**
   * Start Stripe Connect onboarding
   * @param country - ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE")
   * @param reset - If true, deletes existing account and creates a new one
   */
  const startOnboarding = useCallback(async (country?: string, reset?: boolean) => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: { country, reset }
      });
      
      if (error) throw error;

      // Handle error from the edge function
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.url) {
        // Navigate to Stripe onboarding (using location.href to avoid popup blockers)
        window.location.href = data.url;
      } else if (data?.status === "complete") {
        // Already connected
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          status: "complete",
          isLoading: false,
          error: null,
        }));
        toast.success("Your Stripe account is already connected!");
      } else if (data?.status === "verification_pending") {
        // Account is under Stripe verification
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          status: "verification_pending",
          isLoading: false,
          error: null,
        }));
        toast.info(data.message || "Stripe is verifying your account. This can take 1-3 business days.");
      }
    } catch (error) {
      console.error("Error starting Stripe Connect onboarding:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      
      // Show user-friendly error message
      if (errorMessage.includes("STRIPE_CLIENT_ID")) {
        toast.error("Stripe Connect configuration error. Please contact support.");
      } else {
        toast.error(errorMessage);
      }
    }
  }, [user]);

  /**
   * Reset and recreate Stripe Connect account with a new country
   * @param country - ISO 3166-1 alpha-2 country code
   */
  const resetAndRecreate = useCallback(async (country: string) => {
    return startOnboarding(country, true);
  }, [startOnboarding]);

  // Check status on mount and when user changes
  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user, checkStatus]);

  // Listen for connect success/error/refresh URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get("connect_success") === "true" || urlParams.get("connect_refresh") === "true") {
      // Refresh status after returning from Stripe OAuth
      checkStatus();
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      
      if (urlParams.get("connect_success") === "true") {
        toast.success("Stripe account connected successfully!");
      }
    }
    
    // Handle OAuth errors
    const connectError = urlParams.get("connect_error");
    if (connectError) {
      console.error("Stripe Connect OAuth error:", connectError);
      setState(prev => ({ ...prev, error: connectError }));
      toast.error(`Stripe Connect error: ${connectError}`);
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [checkStatus]);

  return {
    ...state,
    checkStatus,
    startOnboarding,
    resetAndRecreate,
  };
}
