import { useState } from "react";
import { CreditCard, Calendar, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

interface ManagePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePlanDialog({ open, onOpenChange }: ManagePlanDialogProps) {
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { subscriptionEnd, isManualOverride, checkSubscription } = useAuth();
  const isMobile = useIsMobile();

  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Format date for display
  const formattedEndDate = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Subscription canceled", {
        description: `You'll keep access until ${formattedEndDate || "the end of your billing period"}.`,
      });
      
      // Refresh subscription status
      await checkSubscription();
      
      setShowCancelConfirm(false);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error canceling subscription:", error);
      const message = error instanceof Error ? error.message : "Failed to cancel subscription";
      toast.error(message);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md bg-card border-border"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <SuperHumanIcon size={48} />
            </div>
            <DialogTitle className="text-center text-xl font-display">
              Your Plan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Plan details */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-shake-yellow/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-shake-yellow" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Super-Human</p>
                  <p className="text-sm text-muted-foreground">$3.88/month</p>
                </div>
              </div>

              {formattedEndDate && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Next billing date</p>
                    <p className="text-sm text-muted-foreground">{formattedEndDate}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel button - only show for Stripe-managed subscriptions */}
            {!isManualOverride && (
              <>
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel Subscription
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  If you cancel, you'll keep access until your current billing period ends.
                </p>
              </>
            )}

            {/* Admin-managed message */}
            {isManualOverride && (
              <p className="text-xs text-center text-muted-foreground">
                Your subscription is managed by an administrator.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              You'll lose access to Super-Human features after{" "}
              <span className="font-medium text-foreground">{formattedEndDate || "your billing period ends"}</span>.
              <br />
              <br />
              You can always resubscribe later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto" disabled={isCanceling}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelSubscription}
              disabled={isCanceling}
            >
              {isCanceling ? "Canceling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
