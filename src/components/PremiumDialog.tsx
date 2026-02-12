import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
<<<<<<< Updated upstream
import { Check, MapPin, Globe, User, MessageSquare, Sparkles, Settings, RotateCcw } from "lucide-react";
import shakeCoin from "@/assets/shake-coin.png";
=======
import { Check, MapPin, Globe, User, Mic, MessageSquare, Sparkles, Settings } from "lucide-react";
>>>>>>> Stashed changes
import shakeCoinTransparent from "@/assets/shake-coin-transparent.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { SuperHumanIcon } from "./SuperHumanIcon";
<<<<<<< Updated upstream
import { KindHumanDonation } from "./KindHumanDonation";
import { useInAppPurchases } from "@/hooks/useInAppPurchases";
import { shouldUseAppleIAP } from "@/lib/platform-utils";
=======
import { Purchases } from '@revenuecat/purchases-capacitor';
import { purchasePremium } from "@/lib/revenuecat";
>>>>>>> Stashed changes

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRODUCT_ID = "shake_premium_monthly"; // You'll create this in App Store Connect

export function PremiumDialog({ open, onOpenChange }: PremiumDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [productPrice, setProductPrice] = useState("€3.88");
  const { user, isPremium, isManualOverride } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // In-app purchases hook for native iOS
  const {
    isNativePlatform,
    isPurchasing,
    packages,
    purchaseSubscription,
    restorePurchases,
    getMonthlyPackage,
    isInitialized: isIAPInitialized,
  } = useInAppPurchases();
  
  // Determine if we should use Apple IAP or Stripe
  const useAppleIAP = shouldUseAppleIAP();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  const features = [
    { icon: Sparkles, text: "Create your own activities unlimited" },
    { icon: Globe, text: "Access to 100+ cities worldwide" },
    { icon: MapPin, text: "Join activities in any city" },
    { icon: User, text: "See other users' profiles unlimited" },
    { icon: MessageSquare, text: "Unlimited text messages" },
  ];

<<<<<<< Updated upstream
  // Handle Apple IAP subscription
  const handleAppleSubscribe = async () => {
    if (!user) {
      onOpenChange(false);
      navigate("/auth");
      toast.info("Please sign in to subscribe");
      return;
    }

    const success = await purchaseSubscription();
    if (success) {
      onOpenChange(false);
    }
  };

  // Handle Stripe subscription (web)
  const handleStripeSubscribe = async () => {
=======
  // Initialize in-app purchases and load product info
  useEffect(() => {
    if (open && !isPremium) {
      initializePurchases();
    }
  }, [open, isPremium]);

  const initializePurchases = async () => {
    try {
      // Get available products
      const { products } = await CapacitorPurchases.getProducts({
        productIdentifiers: [PRODUCT_ID]
      });

      if (products && products.length > 0) {
        const product = products[0];
        setProductPrice(product.priceString);
      }
    } catch (error) {
      console.error("Error initializing purchases:", error);
    }
  };

  const handleSubscribe = async () => {
>>>>>>> Stashed changes
    if (!user) {
      onOpenChange(false);
      navigate("/auth");
      toast.info("Please sign in to subscribe");
      return;
    }

    setIsLoading(true);
    try {
      // Purchase the product
      const { productIdentifier, transactionId } = await CapacitorPurchases.purchaseProduct({
        productIdentifier: PRODUCT_ID
      });

      // Verify purchase with your backend
      const { data, error } = await supabase.functions.invoke("verify-purchase", {
        body: {
          productId: productIdentifier,
          transactionId: transactionId,
          platform: 'ios' // or detect platform
        }
      });

<<<<<<< Updated upstream
      if (data?.url) {
        // Use location.href instead of window.open to avoid popup blockers on iOS/iPad
        window.location.href = data.url;
=======
      if (error) throw error;

      if (data?.success) {
        toast.success("Welcome to Super-Human! 🎉");
        onOpenChange(false);
        // Refresh user premium status
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      
      // Handle user cancellation gracefully
      if (error.code === 'userCancelled') {
        toast.info("Purchase cancelled");
      } else {
        toast.error("Purchase failed. Please try again.");
>>>>>>> Stashed changes
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Unified subscribe handler
  const handleSubscribe = useAppleIAP ? handleAppleSubscribe : handleStripeSubscribe;

  // Handle restore purchases (iOS only)
  const handleRestorePurchases = async () => {
    await restorePurchases();
  };

  const handleManageSubscription = async () => {
    setIsManageLoading(true);
    try {
<<<<<<< Updated upstream
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        throw error;
      }

      // Handle error returned in the response body (500 status with JSON error)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.url) {
        // Use location.href instead of window.open to avoid popup blockers on iOS/iPad
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error: any) {
      console.error("Error opening customer portal:", error);
      toast.error(error?.message || "Failed to open subscription management. Please try again.");
=======
      // Open native subscription management
      await CapacitorPurchases.presentCodeRedemptionSheet();
    } catch (error) {
      console.error("Error opening subscription management:", error);
      toast.error("Please manage your subscription in App Store settings");
>>>>>>> Stashed changes
    } finally {
      setIsManageLoading(false);
    }
  };

<<<<<<< Updated upstream
  const { subscriptionEnd } = useAuth();
  
  // Format subscription end date for display
  const formattedEndDate = useMemo(() => {
    if (!subscriptionEnd) return null;
    try {
      const date = new Date(subscriptionEnd);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return null;
    }
  }, [subscriptionEnd]);

  // If user is premium via Stripe subscription (not manual override), show management view
=======
  const handleRestore = async () => {
    setIsLoading(true);
    try {
      await CapacitorPurchases.restorePurchases();
      
      // Verify restored purchases with backend
      const { data, error } = await supabase.functions.invoke("restore-purchases");
      
      if (error) throw error;
      
      if (data?.hasPremium) {
        toast.success("Purchases restored successfully!");
        window.location.reload();
      } else {
        toast.info("No purchases found to restore");
      }
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Failed to restore purchases");
    } finally {
      setIsLoading(false);
    }
  };

  // If user is premium, show management view
>>>>>>> Stashed changes
  if (isPremium && !isManualOverride) {
    return (
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
              You're a Super-Human! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              You have access to all premium features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-shake-green/20 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-shake-green" />
                </div>
                <span className="text-foreground text-sm">{feature.text}</span>
              </div>
            ))}
          </div>

          {formattedEndDate && (
            <p className="text-sm text-center text-muted-foreground py-2">
              Your subscription renews on <span className="font-medium text-foreground">{formattedEndDate}</span>
            </p>
          )}

          {useAppleIAP ? (
            <>
              <button
                onClick={() => { window.location.href = "https://apps.apple.com/account/subscriptions"; }}
                className="w-full py-3 rounded-xl bg-muted text-foreground font-medium transition-all hover:bg-muted/80 flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Manage in Apple Settings
              </button>
              <button
                onClick={handleRestorePurchases}
                disabled={isPurchasing}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Purchases
              </button>
            </>
          ) : (
            <button
              onClick={handleManageSubscription}
              disabled={isManageLoading}
              className="w-full py-3 rounded-xl bg-muted text-foreground font-medium transition-all hover:bg-muted/80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {isManageLoading ? "Loading..." : "Manage Subscription"}
            </button>
          )}

          <p className="text-xs text-center text-muted-foreground">
<<<<<<< Updated upstream
            Cancel anytime • You'll keep access until {formattedEndDate || "the end of your billing period"}
=======
            Manage your subscription in App Store settings
>>>>>>> Stashed changes
          </p>

          <KindHumanDonation />
        </DialogContent>
      </Dialog>
    );
  }

<<<<<<< Updated upstream
  // If user is premium via manual override, show only Kind Human donation (no benefits list)
=======
  // If user is premium via manual override
>>>>>>> Stashed changes
  if (isPremium && isManualOverride) {
    return (
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
          
          <KindHumanDonation showHeader />
        </DialogContent>
      </Dialog>
    );
  }

  // Non-premium view with purchase button
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src={shakeCoinTransparent} 
              alt="SHAKE Coin" 
              className="w-14 h-14 object-contain"
            />
            <SuperHumanIcon size={40} />
          </div>
          <DialogTitle className="text-center text-xl font-display">
            Become a Super-Human
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-sm">
            Explore and join activities in any city
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-foreground text-sm">{feature.text}</span>
              <Check className="w-3.5 h-3.5 text-shake-green ml-auto shrink-0" />
            </div>
          ))}
        </div>

<<<<<<< Updated upstream
        {/* Email input only needed for Stripe (web) when user has no email */}
        {!useAppleIAP && needsEmail && (
          <div className="space-y-2">
            <Label htmlFor="checkoutEmail">Email for receipt</Label>
            <div className="relative">
              <Input
                id="checkoutEmail"
                type="email"
                placeholder="you@example.com"
                value={checkoutEmail}
                onChange={(e) => setCheckoutEmail(e.target.value)}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                className="bg-background pr-10"
              />
              <SuperHumanIcon size={20} className="absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Your account uses phone login, so we need an email for billing.
            </p>
          </div>
        )}

        <div className="text-center py-2">
          <div className="text-3xl font-display font-bold text-foreground">
            $3.88<span className="text-base font-normal text-muted-foreground">/month</span>
=======
        <div className="text-center py-2">
          <div className="text-3xl font-display font-bold text-foreground">
            {productPrice}<span className="text-base font-normal text-muted-foreground">/month</span>
>>>>>>> Stashed changes
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Cancel anytime • Best value!</p>
        </div>

        <button
          onClick={handleSubscribe}
<<<<<<< Updated upstream
          disabled={isLoading || isPurchasing || (!useAppleIAP && !hasValidEmail)}
=======
          disabled={isLoading}
>>>>>>> Stashed changes
          className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
<<<<<<< Updated upstream
          {isLoading || isPurchasing 
            ? "Loading..." 
            : user 
              ? (useAppleIAP ? "Subscribe with Apple" : "Subscribe Now") 
              : "Sign In to Subscribe"}
=======
          {isLoading ? "Processing..." : user ? "Subscribe Now" : "Sign In to Subscribe"}
        </button>

        <button
          onClick={handleRestore}
          disabled={isLoading}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Restore Purchases
>>>>>>> Stashed changes
        </button>

        {/* Restore purchases button (iOS only) */}
        {useAppleIAP && (
          <button
            onClick={handleRestorePurchases}
            disabled={isPurchasing}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Purchases
          </button>
        )}

        {useAppleIAP ? (
          <div className="text-[10px] text-center text-muted-foreground space-y-1">
            <p>
              Payment will be charged to your Apple ID account at confirmation of purchase.
              Subscription automatically renews unless it is canceled at least 24 hours before
              the end of the current period. Your account will be charged for renewal within
              24 hours prior to the end of the current period. You can manage and cancel your
              subscriptions by going to your App Store account settings after purchase.
            </p>
            <p>
              <a href="/privacy-policy" className="underline">Privacy Policy</a>
              {" • "}
              <a href="/terms-of-service" className="underline">Terms of Service</a>
            </p>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground">
            By subscribing, you agree to our Terms of Service
          </p>
        )}

        <KindHumanDonation />
      </DialogContent>
    </Dialog>
  );
}