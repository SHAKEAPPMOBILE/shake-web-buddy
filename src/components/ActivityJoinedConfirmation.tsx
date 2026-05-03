import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useActivityVenue } from "@/contexts/VenueContext";
import { getActivityById } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedActivityDay } from "@/lib/activity-translations";
import { useTranslation } from "react-i18next";
import { triggerConfettiBurstOnce } from "@/lib/confetti";

interface ActivityJoinedConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  city: string;
  onJoinGroupChat: () => void;
  /** Ticketmaster event group chat (e.g. after payment) — same modal layout, event-driven copy */
  eventConfirmation?: {
    name: string;
    dateLine: string;
    venue: string;
    city: string;
    emoji?: string;
  };
}

export function ActivityJoinedConfirmation({
  open,
  onOpenChange,
  activityType,
  city,
  onJoinGroupChat,
  eventConfirmation,
}: ActivityJoinedConfirmationProps) {
  const { t } = useTranslation();
  const { location: venueInfo, mapsUrl, isTBD, isLoading: venueLoading, venueError, refetchVenues } = useActivityVenue(city, activityType);

  // false = phase 1 (celebration), true = phase 2 (venue + actions)
  const [showVenue, setShowVenue] = useState(false);

  // Reset phase and start the 2.5s timer each time the modal opens
  useEffect(() => {
    if (!open) {
      setShowVenue(false);
      return;
    }
    const timer = setTimeout(() => setShowVenue(true), 2500);
    return () => clearTimeout(timer);
  }, [open]);

  // Confetti for Ticketmaster event confirmations
  useEffect(() => {
    if (!open || !eventConfirmation) return;
    triggerConfettiBurstOnce();
  }, [open, eventConfirmation?.name, eventConfirmation?.dateLine]);

  const label = getTranslatedActivityLabel(t, activityType);
  const activityDay = getTranslatedActivityDay(t, activityType);
  const activityTime = activityType === "dinner" ? "7:00 PM" : activityType === "drinks" ? "8:00 PM" : null;
  const activityMeta = getActivityById(activityType);

  const handleJoinChat = () => {
    onJoinGroupChat();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          background: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Modal card — frosted glass, rounded. Content inside changes; card stays. */}
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden pointer-events-auto"
        style={{
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          borderRadius: "24px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        }}
      >

        {/* ── Ticketmaster / event path (unchanged) ── */}
        {eventConfirmation ? (
          <>
            <div className="px-6 py-6 space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                  <span className="text-4xl">{eventConfirmation.emoji ?? "🎉"}</span>
                </div>
                <h2 className="text-lg font-display font-bold text-gray-900 mb-2">
                  {t("joinConfirmation.youreGoing", "You're going!")}
                </h2>
                <p className="text-base font-semibold text-gray-900 leading-snug mb-1">{eventConfirmation.name}</p>
                <p className="text-sm text-gray-600">{eventConfirmation.dateLine}</p>
              </div>

              <div className="rounded-2xl bg-green-100 border border-green-300 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary">📍</span>
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium text-purple-600 break-words">{eventConfirmation.venue}</p>
                    <p className="text-xs text-muted-foreground mt-1">{eventConfirmation.city}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-3">
              <Button
                onClick={handleJoinChat}
                className="w-full h-12 rounded-full font-semibold text-base gap-2"
                style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                <MessageSquare className="w-5 h-5" />
                {t("joinConfirmation.joinGroupChat", "Join Group Chat")}
              </Button>
              <button
                onClick={() => onOpenChange(false)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {t("joinConfirmation.maybeLater", "Maybe later")}
              </button>
            </div>
          </>
        ) : (
          /* ── Regular carousel join: two-phase single modal ── */
          <div className="relative min-h-[400px]">

            {/* ── PHASE 1: Celebration (first 2.5 s) ── */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 text-center transition-opacity duration-500"
              style={{
                opacity: showVenue ? 0 : 1,
                pointerEvents: showVenue ? "none" : "auto",
              }}
              aria-hidden={showVenue}
            >
              {/* Big bouncing activity icon */}
              <div className="w-24 h-24 rounded-full bg-white overflow-hidden flex items-center justify-center mb-5 animate-bounce-subtle shadow-md">
                {activityMeta?.icon ? (
                  <img
                    src={activityMeta.icon}
                    alt={activityType}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-5xl">{activityMeta?.emoji ?? "🎉"}</span>
                )}
              </div>

              <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">
                🎉 {t("joinConfirmation.youreIn", "You're in!")}
              </h2>

              <p className="text-base font-semibold text-gray-800">{label}</p>

              {activityDay && (
                <p className="text-sm text-gray-500 mt-1">
                  {t("joinConfirmation.thisDay", "This {{day}}", { day: activityDay })}
                  {activityTime ? ` · ${activityTime}` : ""}
                </p>
              )}
            </div>

            {/* ── PHASE 2: Venue info + actions (after 2.5 s) ── */}
            <div
              className="absolute inset-0 flex flex-col px-6 py-6 transition-opacity duration-500"
              style={{
                opacity: showVenue ? 1 : 0,
                pointerEvents: showVenue ? "auto" : "none",
              }}
              aria-hidden={!showVenue}
            >
              {/* Compact header */}
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-white overflow-hidden flex items-center justify-center mx-auto mb-3 shadow-sm">
                  {activityMeta?.icon ? (
                    <img
                      src={activityMeta.icon}
                      alt={activityType}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-3xl">{activityMeta?.emoji ?? "🎉"}</span>
                  )}
                </div>
                <h2 className="text-base font-display font-bold text-gray-900">
                  {t("joinConfirmation.youreInFor", "You're in for {{activity}}!", { activity: label })}
                </h2>
                {activityDay && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("joinConfirmation.thisDay", "This {{day}}", { day: activityDay })}
                    {activityTime ? ` · ${activityTime}` : ""}
                  </p>
                )}
              </div>

              {/* Venue card */}
              {!isTBD && (
                <div className="rounded-2xl bg-green-100 border border-green-300 p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary">📍</span>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {venueLoading ? (
                        <p className="text-sm font-medium text-foreground animate-pulse">
                          {t("joinConfirmation.loadingVenue", "Loading...")}
                        </p>
                      ) : venueError ? (
                        <div className="space-y-2">
                          <p className="text-sm text-amber-600">
                            {t("joinConfirmation.venueLoadFailed", "Couldn't load venue info.")}
                          </p>
                          <Button type="button" variant="outline" size="sm" onClick={() => refetchVenues()}>
                            {t("joinConfirmation.retry", "Retry")}
                          </Button>
                        </div>
                      ) : mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-words"
                        >
                          {venueInfo}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-foreground break-words">{venueInfo}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{city}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions — only visible in phase 2 */}
              <div className="mt-auto space-y-2">
                <Button
                  onClick={handleJoinChat}
                  className="w-full h-12 rounded-full font-semibold text-base gap-2"
                  style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
                >
                  <MessageSquare className="w-5 h-5" />
                  {t("joinConfirmation.joinGroupChat", "Join Group Chat")}
                </Button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {t("joinConfirmation.maybeLater", "Maybe later")}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
