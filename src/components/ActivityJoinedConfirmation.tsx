import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useActivityVenue } from "@/contexts/VenueContext";
import { getActivityById, ACTIVITY_START_TIMES } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedActivityDay } from "@/lib/activity-translations";
import { useTranslation } from "react-i18next";
import { triggerConfettiBurstOnce, triggerConfettiWaterfall } from "@/lib/confetti";
import { playDingDingSound } from "@/lib/notification-sound";
import { supabase } from "@/integrations/supabase/client";

interface ActivityJoinedConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  city: string;
  onJoinGroupChat: () => void;
  /** Called when the user taps "Oraaait!" — should close modal and navigate to Plans tab */
  onGoToPlans?: () => void;
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
  onGoToPlans,
  eventConfirmation,
}: ActivityJoinedConfirmationProps) {
  const { t } = useTranslation();
  const { location: venueInfo, mapsUrl, isTBD, isLoading: venueLoading, venueError, refetchVenues } = useActivityVenue(city, activityType);

  // false = phase 1 (celebration), true = phase 2 (venue + actions)
  const [showVenue, setShowVenue] = useState(false);
  const [attendees, setAttendees] = useState<{ avatar_url: string | null; name: string }[]>([]);

  useEffect(() => {
    if (!open || !activityType || !city) return;
    const fetchAttendees = async () => {
      const { data: joins } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_type", activityType)
        .eq("city", city)
        .limit(5);
      if (!joins || joins.length === 0) return;
      const userIds = joins.map((j: { user_id: string }) => j.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("avatar_url, name")
        .in("user_id", userIds);
      if (profiles) setAttendees(profiles);
    };
    fetchAttendees();
  }, [open, activityType, city]);

  // Reset phase, fire confetti+sound, and start the 2.5s timer each time the modal opens
  useEffect(() => {
    if (!open) {
      setShowVenue(false);
      return;
    }

    if (eventConfirmation) {
      // Ticketmaster event path: burst confetti only
      triggerConfettiBurstOnce();
    } else {
      // Regular join path: full waterfall + ding at phase 1 start
      triggerConfettiWaterfall();
      playDingDingSound();
    }

    const timer = setTimeout(() => setShowVenue(true), 2500);
    return () => clearTimeout(timer);
  }, [open, !!eventConfirmation]);

  const label = getTranslatedActivityLabel(t, activityType);
  const activityDay = getTranslatedActivityDay(t, activityType);
  const activityTime = ACTIVITY_START_TIMES[activityType] ?? null;
  const activityMeta = getActivityById(activityType);

  const trimAddress = (address: string | null | undefined): string => {
    if (!address) return "";
    const parts = address.split(",").map((p) => p.trim());
    return parts.length >= 3 ? parts.slice(0, 2).join(", ") : address;
  };

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
        className="relative z-10 w-full max-w-sm pointer-events-auto"
        style={{
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          borderRadius: "24px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Glass shine reflex */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0))",
            borderRadius: "24px 24px 0 0",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

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
                className="group w-full h-12 rounded-full font-semibold text-base gap-2 overflow-hidden"
                style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                <MessageSquare className="w-5 h-5 shrink-0" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-xs group-focus-within:max-w-xs">
                  {t("joinConfirmation.joinGroupChat", "Join Group Chat")}
                </span>
              </Button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  onGoToPlans?.();
                }}
                className="w-full h-12 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(0,0,0,0.12)",
                  color: "#1a1a1a",
                }}
              >
                Oraaait! 🤙
              </button>
            </div>
          </>
        ) : (
          /* ── Regular carousel join: two-phase single modal ── */
          <>
            {/* ── PHASE 1: Celebration (first 2.5 s) ── */}
            {!showVenue && (
              <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
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
            )}

            {/* ── PHASE 2: Venue info + actions (after 2.5 s) ── */}
            {showVenue && (
              <div className="flex flex-col px-6 py-6">
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
                            {trimAddress(venueInfo)}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-foreground break-words">{trimAddress(venueInfo)}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{city}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attendees preview */}
                {attendees.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 justify-center">
                    <div className="flex -space-x-2">
                      {attendees.slice(0, 4).map((a, i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600" style={{ zIndex: 4 - i }}>
                          {a.avatar_url ? <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" /> : (a.name?.[0] ?? "?")}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{attendees.length > 4 ? `+${attendees.length - 4} going` : `${attendees.length} going`}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      onGoToPlans?.();
                    }}
                    className="w-full h-12 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: "rgba(255,255,255,0.55)",
                      border: "1px solid rgba(0,0,0,0.12)",
                      color: "#1a1a1a",
                    }}
                  >
                    Oraaait! 🤙
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
