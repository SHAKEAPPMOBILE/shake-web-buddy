import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, Globe, User, Mic, MessageSquare, Sparkles } from "lucide-react";
import shakeCoin from "@/assets/shake-coin.png";
import shakeCoinTransparent from "@/assets/shake-coin-transparent.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { SuperHumanIcon } from "./SuperHumanIcon";

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumDialog({ open, onOpenChange }: PremiumDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [savedBillingEmail, setSavedBillingEmail] = useState<string | null>(null);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Load saved billing email from private profile when dialog opens
  useEffect(() => {
    if (open && user) {
      supabase
        .from("profiles_private")
        .select("billing_email")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.billing_email) {
            setSavedBillingEmail(data.billing_email);
            setCheckoutEmail(data.billing_email);
          }
        });
    }
  }, [open, user]);

  const needsEmail = !!user && !user.email;
  const emailToUse = useMemo(() => {
    if (user?.email) return user.email;
    return checkoutEmail.trim();
  }, [user?.email, checkoutEmail]);

  const features = [
    { icon: Sparkles, text: "Create your own activities unlimited" },
    { icon: Globe, text: "Access to 100+ cities worldwide" },
    { icon: MapPin, text: "Join activities in any city" },
    { icon: User, text: "See other users' profiles unlimited" },
    { icon: Mic, text: "Unlimited voice messages" },
    { icon: MessageSquare, text: "Unlimited text messages" },
  ];

  const handleSubscribe = async () => {
    if (!user) {
      onOpenChange(false);
      navigate("/auth");
      toast.info("Please sign in to subscribe");
      return;
    }

    if (needsEmail && !emailToUse) {
      toast.error("Please enter an email to continue");
      return;
    }

    setIsLoading(true);
    try {
      // Save billing email to private profile if user entered one
      if (needsEmail && emailToUse && emailToUse !== savedBillingEmail) {
        await supabase
          .from("profiles_private")
          .upsert({ 
            user_id: user.id,
            billing_email: emailToUse 
          }, { onConflict: 'user_id' });
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: needsEmail ? { email: emailToUse } : undefined,
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, "_blank");
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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

        {needsEmail && (
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
            $5<span className="text-base font-normal text-muted-foreground">/month</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Cancel anytime</p>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={isLoading || (needsEmail && !emailToUse)}
          className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          {isLoading ? "Loading..." : user ? "Subscribe Now" : "Sign In to Subscribe"}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          By subscribing, you agree to our Terms of Service
        </p>
      </DialogContent>
    </Dialog>
  );
}
