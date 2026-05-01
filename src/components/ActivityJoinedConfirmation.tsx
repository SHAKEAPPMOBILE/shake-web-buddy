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
  const { venue, location: venueInfo, mapsUrl, isTBD, isLoading: venueLoading, venueError, refetchVenues } = useActivityVenue(city, activityType);

  // Phase: 'celebration' → 'venue' after 1.5s
  const [showVenue, setShowVenue] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowVenue(false);
      return;
    }
    const timer = setTimeout(() => setShowVenue(true), 1500);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !eventConfirmation) return;
    triggerConfettiBurstOnce();
  }, [open, eventConfirmation?.name, eventConfirmation?.dateLine]);

  const label = getTranslatedActivityLabel(t, activityType);
  const activityDay = getTranslatedActivityDay(t, activityType);
  const activityTime = activityType === 'dinner' ? '7:00 PM' : activityType === 'drinks' ? '8:00 PM' : null;
  const activityMeta = getActivityById(activityType);

  const handleJoinChat = () => {
    onJoinGroupChat();
    onOpenChange(false);
  };

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto"
          onClick={() => onOpenChange(false)}
        />

        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl pointer-events-auto">
          <div className="max-h-[min(80vh,680px)] overflow-y-auto">
            {eventConfirmation ? (
              <div className="px-6 py-4 space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                    <span className="text-4xl">{eventConfirmation.emoji ?? "🎉"}</span>
                  </div>
                  <h2 className="text-lg font-display font-bold text-gray-900 mb-2">
                    {t("joinConfirmation.youreGoing", "You're going!")}
                  </h2>
                  <p className="text-base font-semibold text-gray-900 leading-snug mb-1">{eventConfirmation.name}</p>
                  <p className="text-sm text-gray-900">{eventConfirmation.dateLine}</p>
                </div>
                <div className="rounded-2xl bg-green-100 border border-green-300 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-primary">📍</span>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-purple-600 break-words">{eventConfirmation.venue}</p>
                      <p className="text-xs text-muted-foreground mt-1">{eventConfirmation.city}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 space-y-4 relative">
                {/* Phase 1: Celebration — fades out after 1.5s */}
                <div
                  className="transition-opacity duration-500"
                  style={{ opacity: showVenue ? 0 : 1, pointerEvents: showVenue ? 'none' : 'auto' }}
                >
                  <div className="text-center py-4">
                    <div className="w-20 h-20 rounded-full bg-white overflow-hidden flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                      {activityMeta?.icon ? (
                        <img
                          src={activityMeta.icon}
                          alt={activityType}
                          className="block w-full h-full object-cover rounded-full"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <span className="text-4xl">{activityMeta?.emoji ?? "🎉"}</span>
                      )}
                    </div>
                    <h2 className="text-xl font-display font-bold text-gray-900 mb-1">
                      🎉 {t('joinConfirmation.youreIn', "You're in!")}
                    </h2>
                    {activityDay && (
                      <p className="text-sm text-gray-600">
                        {t('joinConfirmation.thisDay', 'This {{day}}', { day: activityDay })}
                      </p>
                    )}
                    {activityTime && (
                      <p className="text-sm font-medium text-primary">{activityTime}</p>
                    )}
                  </div>
                </div>

                {/* Phase 2: Venue info — fades in after 1.5s */}
                <div
                  className="absolute inset-0 px-6 py-4 transition-opacity duration-500 space-y-4"
                  style={{ opacity: showVenue ? 1 : 0, pointerEvents: showVenue ? 'auto' : 'none' }}
                >
                  <div className="text-center pt-4 pb-2">
                    <div className="w-14 h-14 rounded-full bg-white overflow-hidden flex items-center justify-center mx-auto mb-3">
                      {activityMeta?.icon ? (
                        <img
                          src={activityMeta.icon}
                          alt={activityType}
                          className="block w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="text-3xl">{activityMeta?.emoji ?? "📍"}</span>
                      )}
                    </div>
                    <h2 className="text-base font-display font-bold text-gray-900 mb-0.5">
                      {t('joinConfirmation.youreInFor', "You're in for {{activity}}!", { activity: label })}
                    </h2>
                    {activityDay && (
                      <p className="text-xs text-gray-500">
                        {t('joinConfirmation.thisDay', 'This {{day}}', { day: activityDay })}
                        {activityTime ? ` · ${activityTime}` : ''}
                      </p>
                    )}
                  </div>

                  {!isTBD && (
                    <div className="rounded-2xl bg-green-100 border border-green-300 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="inline-flex items-center justify-center w-5 h-5 text-primary">📍</span>
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          {venueLoading ? (
                            <p className="text-sm font-medium text-foreground animate-pulse">
                              {t('joinConfirmation.loadingVenue', 'Loading...')}
                            </p>
                          ) : venueError ? (
                            <div className="space-y-2">
                              <p className="text-sm text-amber-600 dark:text-amber-400">
                                {t('joinConfirmation.venueLoadFailed', "Couldn't load venue info.")}
                              </p>
                              <Button type="button" variant="outline" size="sm" onClick={() => refetchVenues()}>
                                {t('joinConfirmation.retry', 'Retry')}
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
                            <p className="text-sm font-medium text-foreground break-words">
                              {venueInfo}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{city}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Spacer to keep card height consistent during phase 1 */}
                {!showVenue && <div className="h-20" />}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-white border-t border-border/30 space-y-3">
            <Button
              onClick={handleJoinChat}
              className="w-full h-12 rounded-full font-semibold text-base gap-2"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))",
              }}
            >
              <MessageSquare className="w-5 h-5" />
              {t('joinConfirmation.joinGroupChat', 'Join Group Chat')}
            </Button>

            <button
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {t('joinConfirmation.maybeLater', 'Maybe later')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
