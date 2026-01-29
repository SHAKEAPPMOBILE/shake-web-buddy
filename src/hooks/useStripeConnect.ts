import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StripeConnectState {
  isConnected: boolean;
  status: "pending" | "complete" | null;
  isLoading: boolean;
}

export function useStripeConnect() {
  const { user } = useAuth();
  const [state, setState] = useState<StripeConnectState>({
    isConnected: false,
    status: null,
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
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking Stripe Connect status:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const startOnboarding = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account");
      
      if (error) throw error;

      if (data?.url) {
        // Open Stripe onboarding in new tab
        window.open(data.url, "_blank");
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
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

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
  };
}
