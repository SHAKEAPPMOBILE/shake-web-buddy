import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { triggerConfettiWaterfall } from "@/lib/confetti";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { checkSubscription, isPremium } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Trigger confetti on mount
    triggerConfettiWaterfall();

    // Auto-refresh subscription status
    const refreshStatus = async () => {
      setIsChecking(true);
      await checkSubscription();
      setIsChecking(false);
    };

    refreshStatus();

    // Poll every 3 seconds for up to 30 seconds in case Stripe webhook is delayed
    const interval = setInterval(() => {
      checkSubscription();
    }, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkSubscription]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-shake-green/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-shake-green" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome to Premium!
          </h1>
          <p className="text-muted-foreground">
            Your subscription is now active. Enjoy access to 100+ cities worldwide!
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-5 h-5 text-shake-yellow" />
            <span className="font-semibold text-foreground">Premium Member</span>
          </div>

          {isChecking ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Confirming subscription...</span>
            </div>
          ) : isPremium ? (
            <p className="text-sm text-shake-green">Subscription confirmed!</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Processing your subscription...
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
            size="lg"
          >
            Start Exploring Cities
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/profile")}
            className="w-full"
          >
            Go to Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
