import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActivityPayment() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const createPaymentSession = useCallback(async (activityId: string): Promise<string | null> => {
    if (!user) return null;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-activity-payment", {
        body: { activityId },
      });

      if (error) throw error;

      if (data?.url) {
        return data.url;
      }

      return null;
    } catch (error) {
      console.error("Error creating payment session:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const redirectToPayment = useCallback(async (activityId: string) => {
    const url = await createPaymentSession(activityId);
    if (url) {
      window.open(url, "_blank");
    }
    return !!url;
  }, [createPaymentSession]);

  return {
    isLoading,
    createPaymentSession,
    redirectToPayment,
  };
}
