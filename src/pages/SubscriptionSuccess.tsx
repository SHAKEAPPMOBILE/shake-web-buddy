import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { SuperHumanIcon } from "@/components/SuperHumanIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkSubscription, isPremium } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  const isDonation = searchParams.get("donation") === "true";

  useEffect(() => {
    // Trigger confetti on mount
    triggerConfettiWaterfall();

    // Only check subscription status for non-donation flows
    if (!isDonation) {
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
    } else {
      setIsChecking(false);
    }
  }, [checkSubscription, isDonation]);

  const handleBack = () => {
    navigate("/", { replace: true });
  };

  const handleDonationBack = () => {
    // Navigate to home with state to open profile tab and subscription dialog
    navigate("/", { replace: true, state: { openTab: "profile", openSubscription: true } });
  };

  // Auto-redirect for donation success after 5 seconds
  useEffect(() => {
    if (isDonation) {
      const timer = setTimeout(() => {
        handleDonationBack();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isDonation]);

  // Donation success view
  if (isDonation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Heart className="w-10 h-10 text-pink-500" fill="currentColor" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-display font-bold text-foreground">
              Thank you for your support!
            </h2>
            <p className="text-muted-foreground text-lg">
              It's so beautiful to see other people wanting us to thrive. 💚
            </p>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleDonationBack}
              className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
              size="lg"
            >
              Go back to SHAKE
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Subscription success view (original)
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back navigation header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-semibold text-foreground">Subscription Complete</h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-shake-green/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-shake-green" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-display font-bold text-foreground">
              You're a Super-Human!
            </h2>
            <p className="text-muted-foreground">
              Your subscription is now active. Enjoy access to 100+ cities worldwide!
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <SuperHumanIcon size={20} />
              <span className="font-semibold text-foreground">Super-Human</span>
            </div>

            {isChecking ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <LoadingSpinner size="sm" />
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
              onClick={() => navigate("/", { replace: true })}
              className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
              size="lg"
            >
              Start Exploring Cities
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/profile", { replace: true })}
              className="w-full"
            >
              Go to Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
