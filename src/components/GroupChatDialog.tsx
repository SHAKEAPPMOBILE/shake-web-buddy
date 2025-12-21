import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, BellOff, Bell, LogOut, Loader2, Globe, MapPin, Trash2 } from "lucide-react";
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
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { getActivityLocation, getVenueMapsUrl } from "@/data/venues";
import barManAndCook from "@/assets/bar-man-and-cook.png";
import hikerIllustration from "@/assets/hiker-illustration.png";

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

const chatSuggestions: Record<string, string[]> = {
  lunch: [
    "Hi everyone, who's up for lunch today?",
    "What time works best for everyone?",
    "Any dietary restrictions I should know about?",
  ],
  dinner: [
    "Hey! Anyone free for dinner tonight?",
    "What cuisine are we feeling?",
    "Should we make a reservation?",
  ],
  drinks: [
    "Who's ready for happy hour? 🍻",
    "What time are we meeting up?",
    "Any bar suggestions?",
  ],
  hike: [
    "Morning everyone! Ready to hit the trail?",
    "What's everyone's fitness level?",
    "Don't forget to bring water!",
  ],
};

// Location is now dynamic based on activity type and city
// Lunch/Dinner: Show venue from venues.ts
// Drinks/Hike: Show "TBD - Vote in chat!"

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
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
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

    // Subscribe to message changes (insert and delete)
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activity_messages',
        },
        (payload) => {
          const deletedMessage = payload.old as Message;
          if (deletedMessage.activity_type === activityType && deletedMessage.city === city) {
            setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
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

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("activity_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
    }
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
  const location = getActivityLocation(activityType, city);
  const mapsUrl = getVenueMapsUrl(activityType, city);
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
              {mapsUrl ? (
                <a 
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-shake-yellow hover:text-shake-yellow/80 transition-colors flex items-center gap-1 group"
                >
                  <MapPin className="w-3 h-3" />
                  <span className="group-hover:underline">{location}</span>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground/70">{location}</p>
              )}
            </div>
            {showAttendees && (
              <button 
                onClick={() => setShowParticipantsList(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm">{attendeeCount}</span>
              </button>
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
          <button 
            onClick={() => setShowParticipantsList(true)}
            className="w-full px-4 py-3 border-b border-border/50 text-left hover:bg-muted/30 transition-colors"
          >
            <p className="text-sm text-muted-foreground hover:text-foreground">
              {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} joined today
            </p>
          </button>
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
              {(activityType === 'lunch' || activityType === 'dinner' || activityType === 'drinks') && (
                <div className="bg-white p-2 pb-8 shadow-lg rotate-2 mb-4">
                  <img 
                    src={barManAndCook} 
                    alt="Bar man and cook" 
                    className="w-32 h-32 object-contain"
                  />
                </div>
              )}
              {activityType === 'hike' && (
                <div className="bg-white p-2 pb-8 shadow-lg -rotate-2 mb-4">
                  <img 
                    src={hikerIllustration} 
                    alt="Hiker" 
                    className="w-32 h-32 object-contain"
                  />
                </div>
              )}
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
                  className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} ${!user ? 'blur-sm select-none pointer-events-none' : ''}`}
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
                              setSelectedUserProfile({
                                userId: msg.user_id,
                                userName: profile?.name || null,
                                avatarUrl: profile?.avatar_url || null,
                              });
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
                    <div className={`flex items-center gap-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
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
                      {isOwnMessage && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Suggestions */}
        {messages.length === 0 && user && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {(chatSuggestions[activityType] || chatSuggestions.lunch).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-shake-yellow/10 text-shake-yellow hover:bg-shake-yellow/20 transition-colors border border-shake-yellow/20"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

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

        {/* User Profile Dialog */}
        <UserProfileDialog 
          open={!!selectedUserProfile} 
          onOpenChange={(open) => !open && setSelectedUserProfile(null)}
          userId={selectedUserProfile?.userId || ""}
          userName={selectedUserProfile?.userName || null}
          avatarUrl={selectedUserProfile?.avatarUrl || null}
        />

        {/* Participants List Dialog */}
        <ParticipantsListDialog
          open={showParticipantsList}
          onOpenChange={setShowParticipantsList}
          activityType={activityType}
          city={city}
          onViewProfile={(userId, userName, avatarUrl) => {
            setShowParticipantsList(false);
            setSelectedUserProfile({ userId, userName, avatarUrl });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
