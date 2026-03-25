import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, User, MessageSquare, Sparkles, Settings, Video } from "lucide-react";
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
import { toast } from "@/lib/app-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { Purchases } from '@revenuecat/purchases-capacitor';
import { purchasePremium } from "@/lib/revenuecat";
import { shouldUseStripeSubscriptionCheckout } from "@/lib/platform-utils";
const CapacitorPurchases = Purchases;

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumDialog({ open, onOpenChange }: PremiumDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [productPrice, setProductPrice] = useState("$2.99");
  const { user, isPremium, isManualOverride } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  const features = [
    { icon: Sparkles, text: "Create your own activities unlimited" },
    { icon: User, text: "See other users' profiles unlimited" },
    { icon: MessageSquare, text: "Unlimited text messages" },
    { icon: Video, text: "Upload status video" },
  ];

  // Initialize in-app purchases and load product info
  useEffect(() => {
    if (open && !isPremium) {
      initializePurchases();
    }
  }, [open, isPremium]);

  const initializePurchases = async () => {
    if (shouldUseStripeSubscriptionCheckout()) {
      return;
    }
    try {
      // Load pricing from RevenueCat offerings (native iOS/Android only).
      const offerings = await CapacitorPurchases.getOfferings();
      const pkg =
        offerings.current?.availablePackages.find(
          p =>
            p.product?.identifier === "SuperHuman" ||
            p.identifier === "monthly" ||
            p.product?.identifier?.includes("SuperHuman")
        ) ?? offerings.current?.availablePackages[0];

      if (pkg?.product?.priceString) setProductPrice(pkg.product.priceString);
    } catch (error) {
      console.error("Error initializing purchases:", error);
    }
  };

  const hasPremiumEntitlement = (customerInfo: any): boolean => {
    const entitlements = customerInfo?.entitlements?.active ?? {};
    return entitlements?.premium !== undefined || entitlements?.superhuman !== undefined;
  };

  const handleSubscribe = async () => {
    if (!user) {
      onOpenChange(false);
      navigate("/auth");
      toast.info("Please sign in to subscribe");
      return;
    }

    setIsLoading(true);
    try {
      // Web / non-native: Stripe Checkout. Native iOS/Android: RevenueCat IAP.
      if (shouldUseStripeSubscriptionCheckout()) {
        console.log("Web path: calling create-checkout");
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: {
            userId: user.id,
            email: user.email ?? null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));

        const checkoutUrl = data?.url;
        if (!checkoutUrl || typeof checkoutUrl !== "string") {
          throw new Error("Failed to create checkout session");
        }

        window.location.href = checkoutUrl;
        return;
      }

      // Native purchase via RevenueCat; webhook updates `premium_override` server-side.
      const customerInfo = await purchasePremium();

      if (hasPremiumEntitlement(customerInfo)) {
        toast.success("Welcome to Super-Human! 🎉");
        onOpenChange(false);
        // Refresh user premium status
        window.location.reload();
      } else {
        // Entitlement confirmation may lag behind the client purchase result.
        toast.info("Subscription confirmed. Finalizing access...");
        onOpenChange(false);
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Premium purchase error:", {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        raw: error,
      });

      const msg = String(error?.message ?? error ?? "");
      const lower = msg.toLowerCase();

      if (lower.includes("email required for subscription")) {
        onOpenChange(false);
        toast.info("Add your email to subscribe");
        navigate("/profile", {
          state: {
            focusBillingEmail: true,
            returnTo: location.pathname,
          },
        });
        return;
      }

      // Handle user cancellation gracefully
      if (error?.code === "userCancelled" || error?.userCancelled) {
        toast.info("Purchase cancelled");
      } else {
        if (lower.includes("stripe") && (lower.includes("not set") || lower.includes("missing"))) {
          toast.error("Payments are not configured yet. Please try again later.");
        } else if (lower.includes("verify-purchase") || lower.includes("not found")) {
          toast.error("Subscription verification isn't set up yet. Please try again later.");
        } else if (lower.includes("product not found")) {
          toast.error("Subscription product not found. Please contact support.");
        } else {
          toast.error(msg ? `Purchase failed: ${msg}` : "Purchase failed. Please try again.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (shouldUseStripeSubscriptionCheckout()) {
      toast.info("On the web, manage billing from your Shake account email or contact support.");
      return;
    }
    setIsManageLoading(true);
    try {
      // Open native subscription management
      await CapacitorPurchases.presentCodeRedemptionSheet();
    } catch (error) {
      console.error("Error opening subscription management:", error);
      toast.error("Please manage your subscription in App Store settings");
    } finally {
      setIsManageLoading(false);
    }
  };

  const handleRestore = async () => {
    if (shouldUseStripeSubscriptionCheckout()) {
      toast.info("Restore purchases is for the mobile app. Web subscriptions use Stripe.");
      return;
    }
    setIsLoading(true);
    try {
      await CapacitorPurchases.restorePurchases();

      const customerInfo = await CapacitorPurchases.getCustomerInfo();
      if (hasPremiumEntitlement(customerInfo)) {
        toast.success("Purchases restored successfully!");
        window.location.reload();
      } else {
        toast.info("No active subscription found to restore");
      }
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Failed to restore purchases");
    } finally {
      setIsLoading(false);
    }
  };

  // If user is premium, show management view
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

          <button
            onClick={handleManageSubscription}
            disabled={isManageLoading}
            className="w-full py-3 rounded-xl bg-muted text-foreground font-medium transition-all hover:bg-muted/80 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {isManageLoading ? "Loading..." : "Manage Subscription"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Manage your subscription in App Store settings
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // If user is premium via manual override
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
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <SuperHumanIcon size={48} />
            </div>
            <DialogTitle className="text-center text-xl font-display">
              You're a Super-Human! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              You have premium access with all features unlocked
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

          <p className="text-xs text-center text-muted-foreground">
            Your premium access is managed by an administrator
          </p>
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
            Unlock unlimited creation, profiles, messaging, and more
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {feature.icon ? (
                  <feature.icon className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-primary">
                    📍
                  </span>
                )}
              </div>
              <span className="text-foreground text-sm">{feature.text}</span>
              <Check className="w-3.5 h-3.5 text-shake-green ml-auto shrink-0" />
            </div>
          ))}
        </div>

        <div className="text-center py-2">
          <div className="text-3xl font-display font-bold text-foreground">
            {productPrice}<span className="text-base font-normal text-muted-foreground">/month</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Cancel anytime • Best value!</p>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          {isLoading ? "Processing..." : user ? "Subscribe Now" : "Sign In to Subscribe"}
        </button>

        <button
          onClick={handleRestore}
          disabled={isLoading}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Restore Purchases
        </button>

        <p className="text-xs text-center text-muted-foreground">
          By subscribing, you agree to our Terms of Service
        </p>
      </DialogContent>
    </Dialog>
  );
}