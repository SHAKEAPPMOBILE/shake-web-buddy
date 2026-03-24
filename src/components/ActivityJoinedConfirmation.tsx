import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { useActivityVenue } from "@/contexts/VenueContext";
import { getActivityEmoji } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedActivityDay } from "@/lib/activity-translations";
import { useTranslation } from "react-i18next";

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
  const emoji = getActivityEmoji(activityType);
  const label = getTranslatedActivityLabel(t, activityType);
  const activityDay = getTranslatedActivityDay(t, activityType);
  const activityTime = activityType === 'lunch' ? '12:30 PM' : activityType === 'dinner' ? '7:00 PM' : activityType === 'drinks' ? '8:00 PM' : null;
  const { location: venueInfo, mapsUrl, isTBD, isLoading: venueLoading, venueError, refetchVenues } = useActivityVenue(city, activityType);

  const handleJoinChat = () => {
    onOpenChange(false);
    onJoinGroupChat();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto p-0 gap-0 rounded-3xl border-0 overflow-hidden bg-card">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {eventConfirmation ? (
          <>
            <div className="pt-8 pb-4 px-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                <span className="text-4xl">{eventConfirmation.emoji ?? "🎉"}</span>
              </div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">
                {t('joinConfirmation.youreInFor', "You're in for {{activity}}!", {
                  activity: eventConfirmation.name,
                })}
              </h2>
              <p className="text-sm text-muted-foreground">{eventConfirmation.dateLine}</p>
            </div>
            <div className="px-6 pb-6">
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-primary">📍</span>
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium text-foreground break-words">{eventConfirmation.venue}</p>
                    <p className="text-xs text-muted-foreground mt-1">{eventConfirmation.city}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Success header */}
            <div className="pt-8 pb-4 px-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                <span className="text-4xl">{emoji}</span>
              </div>

              <h2 className="text-xl font-display font-bold text-foreground mb-1">
                {t('joinConfirmation.youreInFor', "You're in for {{activity}}!", { activity: label })}
              </h2>

              {activityDay && (
                <p className="text-sm text-muted-foreground">
                  {t('joinConfirmation.thisDay', 'This {{day}}', { day: activityDay })}
                </p>
              )}
              {activityTime && (
                <p className="text-sm font-medium text-primary">
                  {activityTime}
                </p>
              )}
            </div>

            {/* Venue info */}
            <div className="px-6 pb-6">
              <div className="rounded-2xl bg-muted/50 p-4">
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
                    ) : isTBD ? (
                      <p className="text-sm font-medium text-foreground">
                        {t('joinConfirmation.tbdVoteInChat', 'TBD - Vote in chat!')}
                      </p>
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
            </div>
          </>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
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
      </DialogContent>
    </Dialog>
  );
}
