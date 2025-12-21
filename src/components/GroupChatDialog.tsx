import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, BellOff, Bell, LogOut, Loader2, Globe } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityMute } from "@/hooks/useActivityMute";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AudioWaveform } from "@/components/AudioWaveform";
import { PremiumDialog } from "@/components/PremiumDialog";

interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  onBack: () => void;
  onLeaveActivity?: () => void;
  attendeeCount?: number;
  city?: string;
}

interface Message {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  message: string;
  audio_url?: string | null;
  created_at: string;
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

export function GroupChatDialog({ 
  open, 
  onOpenChange, 
  activityType, 
  onBack, 
  onLeaveActivity,
  attendeeCount = 0,
  city = "New York"
}: GroupChatDialogProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { isMuted, toggleMute } = useActivityMute(city, activityType);
  const { leaveActivity } = useActivityJoins(city);
  const { onlineCount } = useOnlinePresence();
  
  // Get unique user IDs from messages for profile fetching
  const userIds = useMemo(() => {
    return [...new Set(messages.map((msg) => msg.user_id))];
  }, [messages]);
  
  const { profiles } = useUserProfiles(userIds);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when dialog opens
  useEffect(() => {
    if (!open || !activityType) return;

    const fetchMessages = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("activity_messages")
        .select("*")
        .eq("activity_type", activityType)
        .eq("city", city)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('activity-messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.activity_type === activityType && newMessage.city === city) {
            setMessages(prev => [...prev, newMessage]);
            // Play notification sound for messages from others (if not muted)
            if (newMessage.user_id !== user?.id && !isMuted) {
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, activityType, city, isMuted]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    // Handle audio message
    if (pendingAudio) {
      if (!user) {
        toast.error("Please sign in to send messages");
        return;
      }
      
      setIsSending(true);
      try {
        const fileName = `${user.id}/${Date.now()}.webm`;
        
        const { error: uploadError } = await supabase.storage
          .from("voice-notes")
          .upload(fileName, pendingAudio.blob, {
            contentType: "audio/webm",
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("voice-notes")
          .getPublicUrl(fileName);

        const { error: messageError } = await supabase
          .from("activity_messages")
          .insert({
            user_id: user.id,
            activity_type: activityType,
            city: city,
            message: "🎤 Voice note",
            audio_url: urlData.publicUrl,
          });

        if (messageError) throw messageError;
        
        setPendingAudio(null);
        toast.success("Voice note sent!");
      } catch (error) {
        console.error("Error sending voice note:", error);
        toast.error("Failed to send voice note");
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Handle text message
    if (!message.trim() || !user) {
      if (!user) {
        toast.error("Please sign in to send messages");
      }
      return;
    }

    setIsSending(true);

    const { error } = await supabase
      .from("activity_messages")
      .insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
        message: message.trim(),
      });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } else {
      setMessage("");
    }

    setIsSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLeaveActivity = async () => {
    const success = await leaveActivity(activityType);
    if (success) {
      onLeaveActivity?.();
      onOpenChange(false);
    }
  };

  const handleMuteToggle = async () => {
    const success = await toggleMute();
    if (success) {
      toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
    }
  };

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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleMuteToggle}
              className="shrink-0"
              title={isMuted ? "Unmute notifications" : "Mute notifications"}
            >
              {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLeaveActivity}
              className="shrink-0 text-destructive hover:text-destructive"
              title="Leave activity"
            >
              <LogOut className="w-4 h-4" />
            </Button>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
          {!user && messages.length > 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="text-center p-4">
                <div className="flex items-center justify-center gap-2 text-shake-yellow mb-3">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm font-medium">{onlineCount} {onlineCount === 1 ? 'person' : 'people'} online worldwide</span>
                </div>
                <p className="font-semibold text-foreground mb-2">Sign in to view messages</p>
                <p className="text-sm text-muted-foreground">Join the conversation by signing in</p>
              </div>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/50">
              <p className="text-center text-sm">
                Start the conversation!<br />
                Messages from today will appear here.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.user_id === user?.id;
              const profile = profiles[msg.user_id];
              const displayName = isOwnMessage 
                ? 'You' 
                : profile?.name || 'Shaker';
              const avatarUrl = profile?.avatar_url;
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} ${!user ? 'blur-sm select-none pointer-events-none' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0 overflow-hidden border border-border">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : ''}`}>
                      <button 
                        className={`font-semibold text-sm ${!isOwnMessage ? 'hover:underline cursor-pointer' : ''}`}
                        onClick={() => {
                          if (!isOwnMessage) {
                            if (isPremium) {
                              toast.info("Profile view coming soon!");
                            } else {
                              setShowPremiumDialog(true);
                            }
                          }
                        }}
                        disabled={isOwnMessage}
                      >
                        {displayName}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                    </div>
                    <div className={`text-sm text-foreground/90 mt-1 p-2 rounded-lg inline-block ${
                      isOwnMessage 
                        ? 'bg-shake-yellow/20 text-foreground' 
                        : 'bg-muted'
                    }`}>
                      {msg.audio_url ? (
                        <AudioWaveform audioUrl={msg.audio_url} isCompact />
                      ) : (
                        <span>{msg.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <VoiceRecorder 
              onAudioReady={(blob, url) => setPendingAudio({ blob, url })}
              onAudioClear={() => setPendingAudio(null)}
              disabled={isSending}
            />
            {!pendingAudio && (
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-muted/50 border-border/50"
                disabled={isSending}
              />
            )}
            <Button 
              variant="shake" 
              size="icon" 
              onClick={handleSendMessage}
              disabled={isSending || (!message.trim() && !pendingAudio)}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Premium Dialog */}
        <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
      </DialogContent>
    </Dialog>
  );
}
