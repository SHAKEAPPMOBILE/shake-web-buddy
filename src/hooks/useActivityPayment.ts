import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

      // Check for error message in response
      if (data?.error) {
        if (data.error.includes("Stripe onboarding")) {
          toast.error("The activity creator hasn't set up payments yet. Please contact them directly.");
        } else {
          toast.error(data.error);
        }
        return null;
      }

      if (data?.url) {
        return data.url;
      }

      toast.error("Failed to create payment session");
      return null;
    } catch (error) {
      console.error("Error creating payment session:", error);
      toast.error("Failed to process payment. Please try again.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const redirectToPayment = useCallback(async (activityId: string) => {
    const url = await createPaymentSession(activityId);
    if (url) {
      // Use location.href instead of window.open to avoid popup blockers on iOS/iPad
      window.location.href = url;
    }
    return !!url;
  }, [createPaymentSession]);

  return {
    isLoading,
    createPaymentSession,
    redirectToPayment,
  };
}
