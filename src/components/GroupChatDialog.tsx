import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  onBack: () => void;
  attendeeCount?: number;
}

const activityTitles: Record<string, string> = {
  lunch: "Lunch 🍽️",
  dinner: "Dinner 🍝",
  drinks: "Drinks 🍻",
  hike: "Hike 🥾",
};

const activityLocations: Record<string, string> = {
  lunch: "TBD - Vote in chat!",
  dinner: "TBD - Vote in chat!",
  drinks: "TBD - Vote in chat!",
  hike: "TBD - Vote in chat!",
};

export function GroupChatDialog({ open, onOpenChange, activityType, onBack, attendeeCount = 0 }: GroupChatDialogProps) {
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const title = activityTitles[activityType] || activityTitles.lunch;
  const location = activityLocations[activityType] || activityLocations.lunch;
  const formattedDate = format(currentTime, "EEEE, MMMM d");
  const formattedTime = format(currentTime, "h:mm a");

  // Only show attendees if there are any today
  const showAttendees = attendeeCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-border/50">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <DialogTitle className="text-lg font-display">{title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{formattedDate} • {formattedTime}</p>
              <p className="text-xs text-muted-foreground/70">{location}</p>
            </div>
            {showAttendees && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm">{attendeeCount}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Attendees section - only shown if people joined today */}
        {showAttendees ? (
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-sm text-muted-foreground">
              {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} joined today
            </p>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-sm text-muted-foreground/70">
              You're the first one here today! Others will be notified when they join.
            </p>
          </div>
        )}

        {/* Messages placeholder */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-center h-full text-muted-foreground/50">
            <p className="text-center text-sm">
              Chat with others who joined this activity!<br />
              Messages will appear here.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/50">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-muted/50 border-border/50"
            />
            <Button variant="shake" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
