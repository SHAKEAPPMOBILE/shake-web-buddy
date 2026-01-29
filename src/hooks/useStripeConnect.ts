import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StripeConnectState {
  isConnected: boolean;
  status: "pending" | "complete" | null;
  email: string | null;
  isLoading: boolean;
}

export function useStripeConnect() {
  const { user } = useAuth();
  const [state, setState] = useState<StripeConnectState>({
    isConnected: false,
    status: null,
    email: null,
    isLoading: false,
  });

  const checkStatus = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke("check-connect-status");
      
      if (error) throw error;

      setState({
        isConnected: data?.connected || false,
        status: data?.status || null,
        email: data?.email || null,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking Stripe Connect status:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  /**
   * Start Stripe Connect onboarding
   * @param country - ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE")
   * @param reset - If true, deletes existing account and creates a new one
   */
  const startOnboarding = useCallback(async (country?: string, reset?: boolean) => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: { country, reset }
      });
      
      if (error) throw error;

      if (data?.url) {
        // Navigate to Stripe onboarding (using location.href to avoid popup blockers)
        window.location.href = data.url;
      } else if (data?.status === "complete") {
        // Already connected
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          status: "complete",
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error("Error starting Stripe Connect onboarding:", error);
      setState(prev => ({ ...prev, isLoading: false }));
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

  // Listen for connect success/refresh URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get("connect_success") === "true" || urlParams.get("connect_refresh") === "true") {
      // Refresh status after returning from Stripe
      checkStatus();
      
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
