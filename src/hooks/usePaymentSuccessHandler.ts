import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";

interface PaymentSuccessResult {
  activityId: string | null;
  isVerifying: boolean;
  wasSuccessful: boolean;
}

export function usePaymentSuccessHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [verifiedActivityId, setVerifiedActivityId] = useState<string | null>(null);

  const clearPaymentParams = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("payment_success");
    newParams.delete("activity_id");
    newParams.delete("payment_cancelled");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const paymentSuccess = searchParams.get("payment_success");
    const activityId = searchParams.get("activity_id");
    const paymentCancelled = searchParams.get("payment_cancelled");

    // Handle cancelled payment
    if (paymentCancelled === "true") {
      toast.info("Payment cancelled");
      clearPaymentParams();
      return;
    }

    // Handle successful payment
    if (paymentSuccess === "true" && activityId && user && !isVerifying && !wasSuccessful) {
      setIsVerifying(true);

      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-activity-payment", {
            body: { activityId },
          });

          if (error) {
            console.error("Error verifying payment:", error);
            toast.error("Failed to verify payment. Please contact support.");
            return;
          }

          if (data?.success) {
            setWasSuccessful(true);
            setVerifiedActivityId(activityId);
            
            // Show confetti celebration
            triggerConfettiWaterfall();
            
            toast.success("You've joined the activity! 🎉");
          } else if (data?.error) {
            toast.error(data.error);
          }
        } catch (err) {
          console.error("Payment verification error:", err);
          toast.error("Something went wrong. Please try again.");
        } finally {
          setIsVerifying(false);
          clearPaymentParams();
        }
      };

      verifyPayment();
    }
  }, [searchParams, user, isVerifying, wasSuccessful, clearPaymentParams]);

  // Reset state when activity changes
  const resetPaymentState = useCallback(() => {
    setWasSuccessful(false);
    setVerifiedActivityId(null);
  }, []);

  return {
    isVerifying,
    wasSuccessful,
    verifiedActivityId,
    resetPaymentState,
  };
}
