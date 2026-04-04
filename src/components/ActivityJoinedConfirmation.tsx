import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useActivityVenue } from "@/contexts/VenueContext";
import { getActivityById } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedActivityDay } from "@/lib/activity-translations";
import { useTranslation } from "react-i18next";
import { triggerConfettiBurstOnce } from "@/lib/confetti";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('venue fetch result:', {
      activityType,
      city,
      venue,
      error: venueError,
      venueInfo,
      venueLoading,
      isTBD,
    });
  }, [activityType, city, venue, venueError, venueInfo, venueLoading, isTBD]);

  useEffect(() => {
    if (!open || !eventConfirmation) return;
    triggerConfettiBurstOnce();
  }, [open, eventConfirmation?.name, eventConfirmation?.dateLine]);

  const label = getTranslatedActivityLabel(t, activityType);
  const activityDay = getTranslatedActivityDay(t, activityType);
  const activityTime = activityType === 'lunch' ? '12:30 PM' : activityType === 'dinner' ? '7:00 PM' : activityType === 'drinks' ? '8:00 PM' : null;
  const activityMeta = getActivityById(activityType);

  const handleJoinChat = () => {
    onJoinGroupChat();
    onOpenChange(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    const offset = e.clientY - dragStart;
    if (offset > 0) {
      setDragOffset(offset);
    }
  };

  const handleMouseUp = () => {
    if (dragOffset > 80) {
      // User dragged down enough to close
      onOpenChange(false);
    }
    setDragStart(null);
    setDragOffset(0);
  };

  // Full page bottom sheet implementation
  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col pointer-events-auto">
        {/* Semi-transparent overlay */}
        <div
          className="flex-1 bg-black/20 backdrop-blur-sm pointer-events-auto"
          onClick={() => onOpenChange(false)}
        />

        {/* Bottom sheet content */}
        <div
          ref={contentRef}
          className="bg-card rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto"
          style={{
            transform: `translateY(${dragOffset}px)`,
            transition: dragStart === null ? 'transform 0.2s ease-out' : 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Draggable handle bar */}
          <div className="flex flex-col items-center py-3 px-6 pb-2 bg-card border-b border-border/30">
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full cursor-grab active:cursor-grabbing" />
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1">
            {eventConfirmation ? (
              <>
                <div className="pt-8 pb-4 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                    <span className="text-4xl">{eventConfirmation.emoji ?? "🎉"}</span>
                  </div>
                  <h2 className="text-xl font-display font-bold text-foreground mb-2">
                    {t("joinConfirmation.youreGoing", "You're going!")}
                  </h2>
                  <p className="text-base font-semibold text-foreground leading-snug mb-1">{eventConfirmation.name}</p>
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
                  <div className="w-20 h-20 rounded-full bg-white overflow-hidden flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                    {activityMeta?.icon ? (
                      <img
                        src={activityMeta.icon}
                        alt={activityType}
                        className="block w-full h-full object-cover"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <span className="text-4xl">{activityMeta?.emoji ?? "📍"}</span>
                    )}
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
          </ScrollArea>

          {/* Actions - fixed at bottom */}
          <div className="px-6 pb-6 bg-card border-t border-border/30 space-y-3">
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
