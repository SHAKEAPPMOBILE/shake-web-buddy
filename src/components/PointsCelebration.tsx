import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { triggerConfettiBurstOnce } from "@/lib/confetti";
import shakeCoin from "@/assets/shake-coin-transparent.png";

interface PointsCelebrationProps {
  points: number;
  userName?: string;
  /** Where the points came from ("You made it to Sunrise Yoga"). With this or `total`, the card uses the "+N points" layout. */
  message?: string;
  /** The person's new total, shown under the message. */
  total?: number;
}

/**
 * Non-interactive "you just earned points" mockup — fires confetti once on
 * mount and auto-dismisses on its own (the parent clears `points` after
 * CELEBRATION_MS in useWelcomeBonus). No buttons, nothing to dismiss.
 */
export function PointsCelebration({ points, userName, message, total }: PointsCelebrationProps) {
  const { t } = useTranslation();

  useEffect(() => {
    triggerConfettiBurstOnce();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10100] flex items-center justify-center px-6 pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col items-center text-center px-8 py-7 rounded-3xl animate-in fade-in zoom-in-95 duration-300"
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
        }}
      >
        {message !== undefined || total !== undefined ? (
          <>
            <img src={shakeCoin} alt="" className="w-36 h-36 -mt-8 -mb-6 animate-bounce-subtle" />
            <h2 className="text-3xl font-display font-bold text-gray-900">
              {t("points.plusPoints", "+{{points}} points", { points })}
            </h2>
            {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
            {total !== undefined && (
              <span className="mt-3 px-4 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#FFF3E5", color: "#D66216" }}>
                {t("points.nowHave", "You now have {{total}} points", { total })}
              </span>
            )}
          </>
        ) : (
          <>
            <img src={shakeCoin} alt="" className="w-16 h-16 mb-3 animate-bounce-subtle" />
            <h2 className="text-lg font-display font-bold text-gray-900">
              {userName
                ? t("points.congratsNamed", "Congratulations {{name}}!", { name: userName })
                : t("points.congrats", "Congratulations!")}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t("points.youGotPoints", "You got +{{points}} points", { points })}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
