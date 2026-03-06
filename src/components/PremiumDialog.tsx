import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, Globe, User, MessageSquare, Sparkles, Settings } from "lucide-react";
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
import { Purchases } from '@revenuecat/purchases-capacitor';
import { purchasePremium } from "@/lib/revenuecat";
const CapacitorPurchases = Purchases;

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
    if (!user) {
      onOpenChange(false);
      navigate("/auth");
      toast.info("Please sign in to subscribe");
      return;
    }

    setIsLoading(true);
    try {
      // Purchase the product
      const { productIdentifier, transactionId } = await (CapacitorPurchases as any).purchaseProduct({
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
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
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