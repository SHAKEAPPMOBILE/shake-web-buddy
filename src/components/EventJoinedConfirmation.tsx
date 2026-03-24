import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, MessageCircle, X } from "lucide-react";
import type { EventItem } from "@/lib/ticketmaster";

export interface EventJoinedConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventItem | null;
  onEnterGroupChat: () => void;
}

function formatEventDateForCard(event: EventItem): string | null {
  if (event.eventStartAt) {
    const d = new Date(event.eventStartAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return event.date || null;
}

/**
 * Post-join confirmation for Ticketmaster events — matches ActivityJoinedConfirmation /
 * existing payment-success dialog (spacing, typography, gradient CTA, bounce animation).
 */
export function EventJoinedConfirmation({
  open,
  onOpenChange,
  event,
  onEnterGroupChat,
}: EventJoinedConfirmationProps) {
  if (!event) return null;

  const dateLine = formatEventDateForCard(event);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto p-0 gap-0 rounded-3xl border-0 overflow-hidden bg-card">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="pt-8 pb-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
            <span className="text-4xl">{event.emoji ?? "🎉"}</span>
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-1">
            You&apos;re in!
          </h2>
          <p className="text-sm text-muted-foreground">You&apos;ve joined the event</p>
          <p className="text-sm font-semibold text-foreground mt-2 leading-snug">{event.name}</p>
        </div>

        {(event.venue || dateLine) && (
          <div className="px-6 pb-4">
            <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
              {event.venue && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Venue</p>
                    <p className="text-sm font-medium text-foreground break-words">
                      {event.venue}
                      {event.city ? (
                        <span className="text-muted-foreground font-normal">, {event.city}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              )}
              {dateLine && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Date</p>
                    <p className="text-sm font-medium text-foreground">{dateLine}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 pb-8 space-y-3">
          <Button
            type="button"
            onClick={() => {
              onEnterGroupChat();
            }}
            className="w-full h-12 rounded-full font-semibold text-base gap-2"
            style={{
              background: "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))",
            }}
          >
            <MessageCircle className="w-5 h-5" />
            Enter Group Chat
          </Button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Back to Events
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
