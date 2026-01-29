import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { startOfDay } from "date-fns";
import { Plus, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserActivities } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { LoadingSpinner } from "./LoadingSpinner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { detectActivityFromText } from "@/lib/activityDetection";
import { useStripeConnect } from "@/hooks/useStripeConnect";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

const MAX_CHARACTERS = 50;

export function CreateActivityDialog({ open, onOpenChange, city }: CreateActivityDialogProps) {
  const { user, isPremium } = useAuth();
  const { createActivity, isLoading, remainingActivities, myActivities } = useUserActivities(city);
  
  const [planText, setPlanText] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const { isConnected, status: connectStatus, startOnboarding, isLoading: connectLoading } = useStripeConnect();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });
  
  const canCreate = remainingActivities > 0;
  const today = startOfDay(new Date());
  
  // Auto-detect activity type from text
  const detectedActivity = useMemo(() => {
    if (!planText.trim()) return null;
    return detectActivityFromText(planText);
  }, [planText]);
  
  // Check if user already has any activity today
  const hasExistingActivityToday = useMemo(() => {
    if (!myActivities.length) return false;
    
    const todayStart = startOfDay(new Date());
    return myActivities.some(activity => {
      const activityDate = startOfDay(new Date(activity.scheduled_for));
      return activityDate.getTime() === todayStart.getTime();
    });
  }, [myActivities]);
  
  const isValid = planText.trim().length > 0 && !hasExistingActivityToday;

  const handleCreate = async () => {
    if (!isValid || !detectedActivity) return;

    // If setting a price, require Stripe Connect
    if (priceAmount.trim() && (!isConnected || connectStatus !== "complete")) {
      startOnboarding();
      return;
    }

    const success = await createActivity(
      detectedActivity.type, 
      today, 
      planText.trim(),
      undefined,
      priceAmount.trim() || undefined
    );
    if (success) {
      triggerConfettiWaterfall();
      // Reset form
      setPlanText("");
      setPriceAmount("");
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setPlanText("");
    setPriceAmount("");
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARACTERS) {
      setPlanText(text);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent 
        className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto [&>button.dialog-close]:text-white [&>button.dialog-close]:bg-black/50 [&>button.dialog-close]:hover:bg-black/70"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display flex items-center justify-center gap-2">
            <Plus className="w-6 h-6" />
            Propose a Plan
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {isPremium ? (
              <span className="text-shake-yellow">Unlimited plans as a Super-Human ✨</span>
            ) : canCreate ? (
              <>You have <span className="font-bold text-primary">{remainingActivities}</span> plans left this month</>
            ) : (
              <span className="text-destructive">You have used all 3 free plans this month</span>
            )}
          </p>
        </DialogHeader>

        {!user ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please sign in to create activities</p>
          </div>
        ) : !canCreate ? (
          <div className="text-center py-8 space-y-4">
            <div 
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              <SuperHumanIcon size={32} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">You've used all 3 free plans this month</p>
              <p className="text-sm text-muted-foreground mt-1">
                Become a Super-Human for unlimited plans
              </p>
            </div>
            <button 
              onClick={() => setShowPremiumDialog(true)}
              className="px-4 py-2 rounded-full font-medium text-white hover:opacity-90 transition-all flex items-center gap-2 mx-auto"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <SuperHumanIcon size={16} />
              Become a Super-Human
            </button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Text Input - Primary focus */}
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  value={planText}
                  onChange={handleTextChange}
                  placeholder="What do you want to do? e.g., 'Surf session this weekend' or 'Coffee and co-working tomorrow'"
                  maxLength={MAX_CHARACTERS}
                  className="min-h-[100px] resize-none pr-16 text-base"
                  autoFocus
                />
                <span className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                  {planText.length}/{MAX_CHARACTERS}
                </span>
              </div>
            </div>

            {/* Price Input (optional) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">
                  Set a price (optional)
                </label>
              </div>
              <div className="relative">
                <Input
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="e.g., $5, €10, or leave empty for free"
                  className="pl-3"
                />
              </div>
              {priceAmount.trim() && (!isConnected || connectStatus !== "complete") && (
                <p className="text-xs text-amber-600">
                  To receive payments,{" "}
                  <button 
                    type="button"
                    onClick={startOnboarding}
                    className="underline hover:text-amber-700 font-medium"
                  >
                    connect your payout account
                  </button>
                </p>
              )}
              {priceAmount.trim() && isConnected && connectStatus === "complete" && (
                <p className="text-xs text-green-600">
                  ✓ Stripe connected - You'll receive 90% of each payment
                </p>
              )}
            </div>

            {/* Preview - shows detected activity or warning */}
            {detectedActivity && planText.trim() && (
              <div className={cn(
                "p-4 rounded-xl space-y-2",
                hasExistingActivityToday ? "bg-destructive/10 border border-destructive/30" : "bg-muted/50"
              )}>
                {hasExistingActivityToday ? (
                  <>
                    <p className="text-sm font-medium text-destructive">You can't create two activities in the same day</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Preview:</p>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-4xl p-3 rounded-xl", detectedActivity.color)}>
                        {detectedActivity.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">"{planText.trim()}"</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{city} • Today</span>
                          {priceAmount.trim() && (
                            <span className="text-green-600 font-medium">{priceAmount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!isValid || isLoading}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  Creating...
                </span>
              ) : (
                "Create Plan"
              )}
            </button>
          </div>
        )}
      </DialogContent>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </Dialog>
  );
}
