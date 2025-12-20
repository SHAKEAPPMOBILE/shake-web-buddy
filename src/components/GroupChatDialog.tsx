import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users } from "lucide-react";
import { useState } from "react";

interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  onBack: () => void;
}

const activityDetails: Record<string, { title: string; time: string; location: string }> = {
  lunch: { title: "Sunday Brunch 🥐", time: "Today, 12:30 PM", location: "Café Central" },
  dinner: { title: "Italian Night 🍝", time: "Tomorrow, 7:00 PM", location: "Trattoria Roma" },
  drinks: { title: "Friday Drinks 🍻", time: "Friday, 6:00 PM", location: "The Local Pub" },
  hike: { title: "Morning Trail 🥾", time: "Saturday, 8:00 AM", location: "Mountain View Park" },
};

const activityAttendees: Record<string, { name: string; avatar: string }[]> = {
  lunch: [
    { name: "Sarah", avatar: "👩‍🦰" },
    { name: "Tom", avatar: "👨‍🦱" },
    { name: "You", avatar: "😊" },
  ],
  dinner: [
    { name: "Mike", avatar: "👨" },
    { name: "Emma", avatar: "👩" },
    { name: "Carlos", avatar: "🧔" },
    { name: "You", avatar: "😊" },
  ],
  drinks: [
    { name: "Alex", avatar: "🧑" },
    { name: "Lisa", avatar: "👱‍♀️" },
    { name: "You", avatar: "😊" },
  ],
  hike: [
    { name: "Emma", avatar: "👩" },
    { name: "Jake", avatar: "🧑‍🦲" },
    { name: "Nina", avatar: "👩‍🦳" },
    { name: "Sam", avatar: "🧒" },
    { name: "You", avatar: "😊" },
  ],
};

const activityMessages: Record<string, { id: number; user: string; avatar: string; message: string; time: string }[]> = {
  lunch: [
    { id: 1, user: "Sarah", avatar: "👩‍🦰", message: "Can't wait for brunch! 🥐", time: "10:32 AM" },
    { id: 2, user: "Tom", avatar: "👨‍🦱", message: "Same! I heard they have great pancakes", time: "10:35 AM" },
  ],
  dinner: [
    { id: 1, user: "Mike", avatar: "👨", message: "Italian food is the best! 🍝", time: "5:30 PM" },
    { id: 2, user: "Emma", avatar: "👩", message: "I'm bringing my appetite!", time: "5:45 PM" },
    { id: 3, user: "Carlos", avatar: "🧔", message: "Let's try the tiramisu", time: "6:00 PM" },
  ],
  drinks: [
    { id: 1, user: "Alex", avatar: "🧑", message: "First round on me! 🍻", time: "5:00 PM" },
    { id: 2, user: "Lisa", avatar: "👱‍♀️", message: "Yay! See you there!", time: "5:15 PM" },
  ],
  hike: [
    { id: 1, user: "Emma", avatar: "👩", message: "Don't forget sunscreen! ☀️", time: "7:30 AM" },
    { id: 2, user: "Jake", avatar: "🧑‍🦲", message: "I'll bring extra water", time: "7:35 AM" },
    { id: 3, user: "Nina", avatar: "👩‍🦳", message: "Weather looks perfect!", time: "7:40 AM" },
    { id: 4, user: "Sam", avatar: "🧒", message: "Let's do this! 🥾", time: "7:45 AM" },
  ],
};

export function GroupChatDialog({ open, onOpenChange, activityType, onBack }: GroupChatDialogProps) {
  const [message, setMessage] = useState("");
  const details = activityDetails[activityType] || activityDetails.lunch;
  const attendees = activityAttendees[activityType] || activityAttendees.lunch;
  const messages = activityMessages[activityType] || activityMessages.lunch;

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
              <DialogTitle className="text-lg font-display">{details.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{details.time} • {details.location}</p>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span className="text-sm">{attendees.length}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Attendees */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            {attendees.map((attendee) => (
              <div key={attendee.name} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
                  {attendee.avatar}
                </div>
                <span className="text-xs text-muted-foreground mt-1">{attendee.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                {msg.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{msg.user}</span>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm text-foreground/90 mt-1">{msg.message}</p>
              </div>
            </div>
          ))}
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
