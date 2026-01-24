import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, MessageSquare, X } from "lucide-react";
import { getActivityLocation, getVenueMapsUrl } from "@/data/venues";
import { getActivityLabel, getActivityEmoji, getActivityDay } from "@/data/activityTypes";

interface ActivityJoinedConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  city: string;
  onJoinGroupChat: () => void;
}

export function ActivityJoinedConfirmation({
  open,
  onOpenChange,
  activityType,
  city,
  onJoinGroupChat,
}: ActivityJoinedConfirmationProps) {
  const emoji = getActivityEmoji(activityType);
  const label = getActivityLabel(activityType);
  const activityDay = getActivityDay(activityType);
  const venueInfo = getActivityLocation(activityType, city);
  const mapsUrl = getVenueMapsUrl(activityType, city);
  const isTBD = venueInfo === "TBD - Vote in chat!";

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

        {/* Success header */}
        <div className="pt-8 pb-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
            <span className="text-4xl">{emoji}</span>
          </div>
          
          <h2 className="text-xl font-display font-bold text-foreground mb-1">
            You're in for {label}!
          </h2>
          
          {activityDay && (
            <p className="text-sm text-muted-foreground">
              This {activityDay}
            </p>
          )}
        </div>

        {/* Venue info */}
        <div className="px-6 pb-4">
          <div className="rounded-2xl bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {isTBD ? "Location" : "Today's Venue"}
                </p>
                {isTBD ? (
                  <p className="text-sm font-medium text-foreground">
                    TBD - Vote in chat!
                  </p>
                ) : mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline block truncate"
                  >
                    {venueInfo}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-foreground truncate">
                    {venueInfo}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{city}</p>
              </div>
            </div>
          </div>
        </div>

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
            Join Group Chat
          </Button>
          
          <button
            onClick={() => onOpenChange(false)}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
