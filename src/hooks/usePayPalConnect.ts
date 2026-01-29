import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PayPalConnectState {
  isConnected: boolean;
  paypalEmail: string | null;
  isLoading: boolean;
}

export function usePayPalConnect() {
  const { user } = useAuth();
  const [state, setState] = useState<PayPalConnectState>({
    isConnected: false,
    paypalEmail: null,
    isLoading: false,
  });

  const checkStatus = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase
        .from("profiles_private")
        .select("paypal_email, paypal_connected")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;

      setState({
        isConnected: data?.paypal_connected || false,
        paypalEmail: data?.paypal_email || null,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking PayPal status:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  /**
   * Connect PayPal account with email
   * @param email - PayPal email address
   */
  const connectPayPal = useCallback(async (email: string): Promise<boolean> => {
    if (!user || !email) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase
        .from("profiles_private")
        .update({ 
          paypal_email: email,
          paypal_connected: true,
          preferred_payout_method: "paypal"
        })
        .eq("user_id", user.id);
      
      if (error) throw error;

      setState({
        isConnected: true,
        paypalEmail: email,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Error connecting PayPal:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  /**
   * Disconnect PayPal account
   */
  const disconnectPayPal = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase
        .from("profiles_private")
        .update({ 
          paypal_email: null,
          paypal_connected: false,
          preferred_payout_method: null
        })
        .eq("user_id", user.id);
      
      if (error) throw error;

      setState({
        isConnected: false,
        paypalEmail: null,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Error disconnecting PayPal:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Check status on mount and when user changes
  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user, checkStatus]);

  return {
    ...state,
    checkStatus,
    connectPayPal,
    disconnectPayPal,
  };
}
