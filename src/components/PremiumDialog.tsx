import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, User, MessageSquare, Sparkles, Settings } from "lucide-react";
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
import superhumanImg from "@/assets/superhuman-superman.png";
import { Purchases } from '@revenuecat/purchases-capacitor';
import { purchasePremium, identifyRevenueCatUser } from "@/lib/revenuecat";
import { shouldUseStripeSubscriptionCheckout } from "@/lib/platform-utils";
const CapacitorPurchases = Purchases;

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumDialog({ open, onOpenChange }: PremiumDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);
  const [productPrice, setProductPrice] = useState("$1.88");
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
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
  ];

  // Initialize in-app purchases and load product info; clear stale errors on open
  useEffect(() => {
    if (open) {
      setSubscribeError(null);
      if (!isPremium) {
        initializePurchases();
      }
    }
  }, [open, isPremium]);

  const initializePurchases = async () => {
    const useStripe = shouldUseStripeSubscriptionCheckout();
    console.log('[PremiumDialog] initializePurchases — useStripe:', useStripe,
      'platform:', typeof window !== 'undefined' ? (window as any)?.Capacitor?.getPlatform?.() : 'unknown');
    if (useStripe) {
      console.log('[PremiumDialog] Web/Stripe path — skipping RevenueCat offerings fetch');
      return;
    }
    try {
      // Load pricing from RevenueCat offerings (native iOS/Android only).
      const offerings = await CapacitorPurchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      console.log('[PremiumDialog] offerings packages:', packages.map(p => ({
        id: p.identifier,
        productId: p.product?.identifier,
        price: p.product?.priceString,
      })));
      const pkg =
        packages.find(p => p.product?.identifier === "SuperHuman") ??
        packages.find(p => p.product?.identifier?.toLowerCase().includes("superhuman")) ??
        packages.find(p => p.identifier === "monthly") ??
        packages[0];

      if (pkg?.product?.priceString) {
        console.log('[PremiumDialog] setting price from RevenueCat:', pkg.product.priceString);
        setProductPrice(pkg.product.priceString);
      } else {
        console.warn('[PremiumDialog] no priceString found — keeping default', productPrice);
      }
    } catch (error: any) {
      console.error('[PremiumDialog] Error initializing purchases:', {
        message: error?.message,
        code: error?.code,
        readableErrorCode: error?.readableErrorCode,
        raw: JSON.stringify(error),
      });
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

    // Clear any previous error on a new attempt
    setSubscribeError(null);

    const useStripe = shouldUseStripeSubscriptionCheckout();
    const platform = useStripe ? "web/stripe" : "native/revenuecat";

    // Log full platform context so we can see exactly which path is taken on device
    console.log('[Subscribe] handleSubscribe start', {
      platform,
      userId: user.id,
      useStripe,
      capacitorPlatform: (() => { try { const { Capacitor } = require('@capacitor/core'); return Capacitor.getPlatform(); } catch { return 'unknown'; } })(),
      isNative: (() => { try { const { Capacitor } = require('@capacitor/core'); return Capacitor.isNativePlatform(); } catch { return 'unknown'; } })(),
    });

    setIsLoading(true);

    // Safety net: reset loading after 15s no matter what, so UI never stays stuck
    const loadingResetTimer = setTimeout(() => {
      console.warn('[Subscribe] Safety timeout fired — resetting loading state after 15s');
      setIsLoading(false);
      setSubscribeError("Purchase timed out. Please try again.");
      toast.error("Purchase timed out. Please try again.");
    }, 15000);

    try {
      // Web / non-native: Stripe Checkout. Native iOS/Android: RevenueCat IAP.
      if (useStripe) {
        console.log('[Subscribe] → Web/Stripe path: calling create-checkout edge function...');
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: {
            userId: user.id,
            email: user.email ?? null,
          },
        });

        console.log('[Subscribe] create-checkout response:', { data, error });
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));

        const checkoutUrl = data?.url;
        if (!checkoutUrl || typeof checkoutUrl !== "string") {
          throw new Error("Failed to create checkout session");
        }

        console.log('[Subscribe] Redirecting to Stripe checkout:', checkoutUrl);
        window.location.href = checkoutUrl;
        return;
      }

      // Native purchase via RevenueCat; webhook updates `premium_override` server-side.
      console.log('[Subscribe] → Native/RevenueCat path: identifying user...');
      await identifyRevenueCatUser(user.id);
      console.log('[Subscribe] identifyRevenueCatUser done, calling purchasePremium...');
      const customerInfo = await purchasePremium();
      console.log('[Subscribe] purchasePremium returned, entitlements:', Object.keys(customerInfo?.entitlements?.active ?? {}));

      if (hasPremiumEntitlement(customerInfo)) {
        toast.success("Welcome to Super-Human! 🎉");
        onOpenChange(false);
        window.location.reload();
      } else {
        // Entitlement confirmation may lag behind the client purchase result.
        toast.info("Subscription confirmed. Finalizing access...");
        onOpenChange(false);
        window.location.reload();
      }
    } catch (error: any) {
      // Log every property the RevenueCat/Stripe error object may carry
      console.error('[Subscribe] Purchase error — full details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        readableErrorCode: error?.readableErrorCode,
        userCancelled: error?.userCancelled,
        underlyingErrorMessage: error?.underlyingErrorMessage,
        raw: (() => { try { return JSON.stringify(error); } catch { return String(error); } })(),
      });

      const msg = String(error?.message ?? error ?? "");
      const lower = msg.toLowerCase();
      const readableCode = String(error?.readableErrorCode ?? "").toLowerCase();

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

      // RevenueCat user cancellation: check both the boolean flag and common code strings
      const isUserCancelled =
        error?.userCancelled === true ||
        error?.code === 1 || // PurchasesErrorCode.purchaseCancelledError
        readableCode.includes("cancelled") ||
        lower.includes("cancelled") ||
        lower.includes("user cancel");

      if (isUserCancelled) {
        console.log('[Subscribe] User cancelled purchase — not an error');
        toast.info("Purchase cancelled");
        // No error state shown for user-initiated cancellation
      } else {
        let errorMsg: string;
        if (lower.includes("stripe") && (lower.includes("not set") || lower.includes("missing"))) {
          errorMsg = "Payments are not configured yet. Please try again later.";
        } else if (lower.includes("no purchasable package")) {
          errorMsg = "No subscription package available. Check your App Store connection.";
        } else if (lower.includes("product not found")) {
          errorMsg = "Subscription product not found. Please contact support.";
        } else if (lower.includes("verify-purchase") || lower.includes("not implemented")) {
          errorMsg = "Purchase verification failed. Please try again.";
        } else if (lower.includes("not configured") || lower.includes("not initialized")) {
          errorMsg = "Payment system not ready. Restart the app and try again.";
        } else if (lower.includes("network") || lower.includes("internet")) {
          errorMsg = "Network error. Check your connection and try again.";
        } else {
          errorMsg = msg ? `Purchase failed: ${msg}` : "Purchase failed. Please try again.";
        }
        toast.error(errorMsg);
        setSubscribeError(errorMsg);
      }
    } finally {
      clearTimeout(loadingResetTimer);
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
    console.log('[Subscribe] handleRestore: restoring purchases...');
    setIsLoading(true);
    const restoreResetTimer = setTimeout(() => {
      console.warn('[Subscribe] Restore safety timeout fired after 15s');
      setIsLoading(false);
      toast.error("Restore timed out. Please try again.");
    }, 15000);
    try {
      await CapacitorPurchases.restorePurchases();
      const customerInfo = await CapacitorPurchases.getCustomerInfo();
      console.log('[Subscribe] restore customerInfo entitlements:', Object.keys((customerInfo as any)?.entitlements?.active ?? {}));
      if (hasPremiumEntitlement(customerInfo)) {
        toast.success("Purchases restored successfully!");
        window.location.reload();
      } else {
        toast.info("No active subscription found to restore");
      }
    } catch (error) {
      console.error('[Subscribe] Restore error:', error);
      toast.error("Failed to restore purchases");
    } finally {
      clearTimeout(restoreResetTimer);
      setIsLoading(false);
    }
  };

  // If user is premium, show management view
  if (isPremium && !isManualOverride) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-md"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-center mb-2">
              <img src={superhumanImg} alt="Super-Human" className="w-32 object-contain" />
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
          className="sm:max-w-md"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-center mb-2">
              <img src={superhumanImg} alt="Super-Human" className="w-32 object-contain" />
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
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-center mb-2">
            <img src={superhumanImg} alt="Super-Human" className="w-32 object-contain" />
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
            background: "linear-gradient(to right, #2563EB, #1d4ed8)",
          }}
        >
          {isLoading ? "Processing..." : user ? "Subscribe Now" : "Sign In to Subscribe"}
        </button>

        {subscribeError && (
          <p className="text-xs text-red-500 text-center px-2 -mt-1">
            {subscribeError}
          </p>
        )}

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