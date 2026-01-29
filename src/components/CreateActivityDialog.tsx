import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { startOfDay } from "date-fns";
import { Plus, User } from "lucide-react";
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
import { checkProfanity } from "@/lib/profanity-filter";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { usePayPalConnect } from "@/hooks/usePayPalConnect";
import { supabase } from "@/integrations/supabase/client";
import { StripeCountrySelectorDialog } from "@/components/StripeCountrySelectorDialog";
import { PayPalConnectDialog } from "@/components/PayPalConnectDialog";
import { useToast } from "@/hooks/use-toast";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

const MAX_CHARACTERS = 50;

export function CreateActivityDialog({ open, onOpenChange, city }: CreateActivityDialogProps) {
  const { user, isPremium } = useAuth();
  const { createActivity, isLoading, remainingActivities, myActivities, fetchMyActivities } = useUserActivities(city);
  const { toast } = useToast();
  
  const [planText, setPlanText] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [showStripeCountrySelector, setShowStripeCountrySelector] = useState(false);
  const [showPayPalDialog, setShowPayPalDialog] = useState(false);
  const [profanityError, setProfanityError] = useState<string | null>(null);
  const { isConnected: stripeConnected, status: connectStatus, startOnboarding, isLoading: connectLoading } = useStripeConnect();
  const { isConnected: paypalConnected, connectPayPal, isLoading: paypalLoading } = usePayPalConnect();
  const isMobile = useIsMobile();
  
  // Refetch myActivities when dialog opens to ensure fresh data after deletions
  useEffect(() => {
    if (open && user) {
      fetchMyActivities();
    }
  }, [open, user, fetchMyActivities]);
  
  // Fetch current user's avatar
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setUserAvatarUrl(data.avatar_url);
      }
    };
    fetchUserProfile();
  }, [user]);
  
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
  
  // Check for profanity
  const hasProfanity = useMemo(() => {
    if (!planText.trim()) return false;
    return checkProfanity(planText).hasProfanity;
  }, [planText]);

  // For paid activities without Stripe connected, we still allow creation but will prompt for Stripe
  const isValid = planText.trim().length > 0 && !hasExistingActivityToday && !hasProfanity;
  const isPaidActivity = priceAmount.trim().length > 0;
  const hasPayoutMethod = (stripeConnected && connectStatus === "complete") || paypalConnected;
  const needsPayoutSetup = isPaidActivity && !hasPayoutMethod;

  const handleStartOnboardingWithCountry = (countryCode: string) => {
    setShowStripeCountrySelector(false);
    startOnboarding(countryCode);
  };

  const handleCreate = async () => {
    if (!isValid || !detectedActivity) return;

    // If setting a price, require a payout method (Stripe or PayPal)
    if (priceAmount.trim() && !hasPayoutMethod) {
      // Show option to connect - default to showing Stripe country selector
      setShowStripeCountrySelector(true);
      return;
    }

    // Format price with currency symbol
    const selectedCurrency = CURRENCIES.find(c => c.code === priceCurrency);
    const formattedPrice = priceAmount.trim() 
      ? `${selectedCurrency?.symbol || '$'}${priceAmount.trim()} ${priceCurrency}`
      : undefined;

    const success = await createActivity(
      detectedActivity.type, 
      today, 
      planText.trim(),
      undefined,
      formattedPrice
    );
    if (success) {
      triggerConfettiWaterfall();
      // Reset form
      setPlanText("");
      setPriceAmount("");
      setPriceCurrency("USD");
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setPlanText("");
    setPriceAmount("");
    setPriceCurrency("USD");
    setProfanityError(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARACTERS) {
      setPlanText(text);
      
      // Check for profanity and show/hide error
      const result = checkProfanity(text);
      if (result.hasProfanity) {
        setProfanityError("Please use appropriate language for your activity description.");
      } else {
        setProfanityError(null);
      }
    }
  };

  const selectedCurrencySymbol = CURRENCIES.find(c => c.code === priceCurrency)?.symbol || '$';

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
              
              {/* Profanity error message */}
              {profanityError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                  {profanityError}
                </p>
              )}
            </div>

            {/* Price Input (optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Set a price (optional)
              </label>
              <div className="flex gap-2">
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="Amount (e.g., 5)"
                  className="flex-1"
                />
              </div>
              {priceAmount.trim() && !hasPayoutMethod && (
                <div className="text-xs text-amber-600 space-y-1">
                  <p>To receive payments, connect a payout method:</p>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowStripeCountrySelector(true)}
                      className="underline hover:text-amber-700 font-medium"
                    >
                      Stripe
                    </button>
                    <span>or</span>
                    <button 
                      type="button"
                      onClick={() => setShowPayPalDialog(true)}
                      className="underline hover:text-amber-700 font-medium"
                    >
                      PayPal
                    </button>
                  </div>
                </div>
              )}
              {priceAmount.trim() && hasPayoutMethod && (
                <p className="text-xs text-green-600">
                  ✓ {paypalConnected ? "PayPal" : "Stripe"} connected - You'll receive 90% of each payment
                </p>
              )}
            </div>

            {/* Preview - shows detected activity or warning */}
            {planText.trim() && (
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
                      {/* Show emoji only if activity detected, otherwise show user avatar */}
                      {detectedActivity ? (
                        <span className={cn("text-4xl p-3 rounded-xl", detectedActivity.color)}>
                          {detectedActivity.emoji}
                        </span>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                          {userAvatarUrl ? (
                            <img 
                              src={userAvatarUrl} 
                              alt="Your avatar" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">"{planText.trim()}"</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{city} • Today</span>
                          {priceAmount.trim() && (
                            <span className="text-green-600 font-medium">
                              {selectedCurrencySymbol}{priceAmount}
                            </span>
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
              disabled={!isValid || isLoading || connectLoading}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              {isLoading || connectLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {connectLoading ? "Checking payment setup..." : "Creating..."}
                </span>
              ) : needsPayoutSetup ? (
                "Set Up Payments & Create"
              ) : (
                "Create Plan"
              )}
            </button>
          </div>
        )}
      </DialogContent>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />

      {/* Stripe country selector (always choose country before onboarding) */}
      <StripeCountrySelectorDialog
        open={showStripeCountrySelector}
        onOpenChange={setShowStripeCountrySelector}
        onSelectCountry={handleStartOnboardingWithCountry}
        isLoading={connectLoading}
        isReset={false}
      />

      {/* PayPal connect dialog */}
      <PayPalConnectDialog
        open={showPayPalDialog}
        onOpenChange={setShowPayPalDialog}
        onConnect={connectPayPal}
        isLoading={paypalLoading}
      />
    </Dialog>
  );
}
