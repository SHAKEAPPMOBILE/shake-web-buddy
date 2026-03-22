import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import {
  triggerConfettiWaterfall,
  triggerConfettiWaterfallMonochrome,
} from "@/lib/confetti";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useAuth();

  const isDonation = searchParams.get("donation") === "true";

  useEffect(() => {
    if (isDonation) {
      triggerConfettiWaterfall();
    } else {
      triggerConfettiWaterfallMonochrome();
    }

    // Only check subscription status for non-donation flows
    if (!isDonation) {
      const refreshStatus = async () => {
        await checkSubscription();
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

  // Subscription success — dark cinematic “achievement unlock” aesthetic
  return (
    <div
      className="min-h-screen flex flex-col text-[#f0f0f0]"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <style>{`
        @keyframes subscription-success-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .subscription-success-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: clamp(1.75rem, 6vw, 52px);
          line-height: 1.12;
          letter-spacing: -0.02em;
          background: linear-gradient(
            110deg,
            #c8c8c8 0%,
            #f0f0f0 18%,
            #f5f5f5 42%,
            #a8a8b0 50%,
            #f0f0f0 58%,
            #d8d8d8 82%,
            #f0f0f0 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: subscription-success-shimmer 4.5s ease-in-out infinite;
        }
      `}</style>

      <header
        className="sticky top-0 z-10 border-b border-[#1a1a1a] backdrop-blur-md"
        style={{ backgroundColor: "rgba(10, 10, 10, 0.92)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full text-[#e0e0e0] hover:bg-white/5 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-medium text-sm tracking-wide text-[#888] uppercase">
            Subscription Complete
          </h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full flex flex-col items-center gap-10">
          {/* HUD-style frame around unlock copy */}
          <div className="relative w-full border border-[#2a2a2a] px-6 py-10 sm:px-10 sm:py-12">
            {/* L-shaped corner brackets */}
            <span
              className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l border-t border-[#666]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r border-t border-[#666]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[#666]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b border-r border-[#666]"
              aria-hidden
            />

            <div className="flex flex-col items-center text-center gap-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border border-[#333]"
                style={{ backgroundColor: "#111111" }}
              >
                <LoadingSpinner size="lg" />
              </div>

              <div className="space-y-5 w-full">
                <p
                  className="font-mono text-[11px] sm:text-xs uppercase text-[#555] tracking-[0.4em]"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                >
                  STATUS: UNLOCKED
                </p>
                <h2 className="subscription-success-heading px-1">
                  {"You're a Super-Human!"}
                </h2>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="w-full max-w-sm py-3.5 px-6 rounded-lg border border-[#444] bg-[#0a0a0a] text-[#f5f5f5] text-base font-medium transition-all duration-300 hover:border-[#666] hover:bg-[#121212] hover:shadow-[0_0_24px_rgba(255,255,255,0.07)] active:scale-[0.99]"
          >
            Start Exploring!
          </button>
        </div>
      </div>
    </div>
  );
}
