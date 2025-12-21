import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Check, MapPin, Globe, User } from "lucide-react";
import shakeCoin from "@/assets/shake-coin.png";
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
    { icon: Globe, text: "Access to 100+ cities worldwide" },
    { icon: MapPin, text: "Join activities in any city" },
    { icon: Crown, text: "Premium badge on your profile" },
    { icon: User, text: "See other users' profiles" },
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
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <img 
              src={shakeCoin} 
              alt="SHAKE Coin" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <DialogTitle className="text-center text-2xl font-display">
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Unlock the ability to explore and join activities in any city
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-foreground">{feature.text}</span>
              <Check className="w-4 h-4 text-shake-green ml-auto" />
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
              <Crown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-shake-yellow ${isEmailFocused ? 'animate-shake' : ''}`} />
            </div>
            <p className="text-xs text-muted-foreground">
              Your account uses phone login, so we need an email for billing.
            </p>
          </div>
        )}

        <div className="text-center py-4">
          <div className="text-4xl font-display font-bold text-foreground">
            $5<span className="text-lg font-normal text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Cancel anytime</p>
        </div>

        <Button
          onClick={handleSubscribe}
          className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
          size="lg"
          disabled={isLoading || (needsEmail && !emailToUse)}
        >
          <Crown className="w-4 h-4 mr-2" />
          {isLoading ? "Loading..." : user ? "Subscribe Now" : "Sign In to Subscribe"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By subscribing, you agree to our Terms of Service
        </p>
      </DialogContent>
    </Dialog>
  );
}
