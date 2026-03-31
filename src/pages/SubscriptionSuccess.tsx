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

  // Subscription success — Speedrun-style HUD (a16z-inspired blue terminal)
  return (
    <div
      className="min-h-screen flex flex-col text-[#e8f0ff]"
      style={{
        background:
          "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(59,130,246,0.04) 0%, transparent 55%), #060810",
      }}
    >
      <style>{`
        @keyframes heading-blue-glint {
          0% { background-position: -80% 0; }
          100% { background-position: 180% 0; }
        }
        .subscription-success-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: clamp(1.75rem, 6vw, 52px);
          line-height: 1.12;
          letter-spacing: -0.02em;
          color: #e8f0ff;
          background: linear-gradient(
            100deg,
            #e8f0ff 0%,
            #e8f0ff 38%,
            #bfdbfe 47%,
            #f8fafc 50%,
            #bfdbfe 53%,
            #e8f0ff 62%,
            #e8f0ff 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: heading-blue-glint 7s ease-in-out infinite;
        }
        @keyframes hud-scan-sweep {
          0% { top: 0; opacity: 0.4; }
          10% { opacity: 0.95; }
          90% { opacity: 0.95; }
          100% { top: calc(100% - 2px); opacity: 0.4; }
        }
        .hud-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.15) 15%,
            rgba(96, 165, 250, 0.55) 50%,
            rgba(59, 130, 246, 0.15) 85%,
            transparent 100%
          );
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.35);
          animation: hud-scan-sweep 5.5s linear infinite;
        }
        @keyframes status-dot-pulse {
          0%, 100% { opacity: 0.55; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45); }
          50% { opacity: 1; box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.35); }
        }
        .status-pulse-dot {
          animation: status-dot-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <header
        className="sticky top-0 z-30 border-b border-[#1e293b]/80 backdrop-blur-md"
        style={{ backgroundColor: "rgba(6, 8, 16, 0.94)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full text-[#94a3b8] hover:text-[#e8f0ff] hover:bg-white/5 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-medium text-sm tracking-[0.2em] text-[#64748b] uppercase">
            Subscription Complete
          </h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full flex flex-col items-center gap-10">
          {/* HUD frame — blue glow, depth, radar scan */}
          <div
            className="relative w-full overflow-hidden px-6 py-10 sm:px-10 sm:py-12 rounded-sm"
            style={{
              background: "linear-gradient(180deg, #0d1117 0%, #0a0e14 100%)",
              border: "1px solid #1e3a5f",
              boxShadow:
                "0 -1px 20px rgba(59,130,246,0.3), inset 0 1px 0 rgba(59,130,246,0.2), 0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            {/* Scanning line (radar / HUD) */}
            <div
              className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-sm"
              aria-hidden
            >
              <div className="hud-scan-line" />
            </div>

            {/* L-shaped corner brackets — bright blue */}
            <span
              className="pointer-events-none absolute left-0 top-0 z-[3] h-5 w-5 border-l-2 border-t-2 border-[#3b82f6]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute right-0 top-0 z-[3] h-5 w-5 border-r-2 border-t-2 border-[#3b82f6]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-0 left-0 z-[3] h-5 w-5 border-b-2 border-l-2 border-[#3b82f6]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-0 right-0 z-[3] h-5 w-5 border-b-2 border-r-2 border-[#3b82f6]"
              aria-hidden
            />

            <div className="relative z-[2] flex flex-col items-center text-center gap-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1e3a5f]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(15,23,42,0.9) 0%, rgba(10,14,20,0.95) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(59,130,246,0.12)",
                }}
              >
                <LoadingSpinner size="lg" />
              </div>

              <div className="space-y-5 w-full">
                <p
                  className="font-mono flex items-center justify-center gap-2 text-[11px] sm:text-xs uppercase text-[#3b82f6] tracking-[0.35em]"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                >
                  <span
                    className="status-pulse-dot inline-block h-2 w-2 shrink-0 rounded-full bg-[#3b82f6]"
                    aria-hidden
                  />
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
            className="w-full max-w-sm rounded-2xl border border-[#3b82f6] bg-transparent py-3.5 px-6 text-base font-medium text-[#3b82f6] transition-all duration-300 hover:bg-[#3b82f6] hover:text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-[0.99]"
          >
            Start Exploring!
          </button>
        </div>
      </div>
    </div>
  );
}
