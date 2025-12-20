import { Crown, Check, MapPin, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe: () => void;
}

export function PremiumDialog({ open, onOpenChange, onSubscribe }: PremiumDialogProps) {
  const features = [
    { icon: Globe, text: "Access to 100+ cities worldwide" },
    { icon: MapPin, text: "Join activities in any city" },
    { icon: Crown, text: "Premium badge on your profile" },
  ];

  const handleSubscribe = () => {
    // TODO: Integrate with Stripe for actual payment
    onSubscribe();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-shake-yellow/20 flex items-center justify-center">
              <Crown className="w-8 h-8 text-shake-yellow" />
            </div>
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

        <div className="text-center py-4">
          <div className="text-4xl font-display font-bold text-foreground">
            $5<span className="text-lg font-normal text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cancel anytime
          </p>
        </div>

        <Button
          onClick={handleSubscribe}
          className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
          size="lg"
        >
          <Crown className="w-4 h-4 mr-2" />
          Subscribe Now
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By subscribing, you agree to our Terms of Service
        </p>
      </DialogContent>
    </Dialog>
  );
}
