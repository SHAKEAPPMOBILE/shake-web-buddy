import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Users, User, BellOff, Bell, LogOut, MapPin, Trash2, Plane } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityMute } from "@/hooks/useActivityMute";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { PremiumDialog } from "@/components/PremiumDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { useActivityVenue } from "@/contexts/VenueContext";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { LoadingSpinner } from "../LoadingSpinner";
import { getActivityLabel, getActivityEmoji, getActivityDay } from "@/data/activityTypes";

interface GroupChatViewProps {
  activityType: string;
  city: string;
  homeCity?: string;
  onBack: () => void;
  attendeeCount?: number;
}

interface Message {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  message: string;
  created_at: string;
}

const defaultSuggestions = [
  "What time works best?",
  "Where should we meet?",
  "Count me in!",
  "See you there! 👋",
  "I'm running late!",
  "On my way! 🏃",
];

const chatSuggestions: Record<string, string[]> = {
  lunch: defaultSuggestions,
  dinner: [
    "What cuisine are we feeling?",
    "Should we make a reservation?",
    "Count me in!",
    "See you there! 👋",
    "I'm running late!",
    "Where should we meet?",
  ],
  drinks: [
    "Who's ready for happy hour? 🍻",
    "What time are we meeting up?",
    "Any bar suggestions?",
    "Count me in!",
    "See you there! 👋",
    "I'm running late!",
    "On my way! 🏃",
  ],
  hike: [
    "Morning everyone! Ready to hit the trail?",
    "Where's the meeting point?",
    "What should I bring?",
    "Count me in!",
    "See you there! 👋",
    "I'm running late!",
    "On my way! 🏃",
  ],
  surf: [
    "What's the wave forecast? 🌊",
    "Which beach are we hitting?",
    "Count me in!",
    "See you there! 👋",
    "On my way! 🏃",
  ],
  run: [
    "What pace are we thinking? 🏃",
    "Where's the starting point?",
    "Count me in!",
    "See you there! 👋",
    "On my way!",
  ],
  "co-working": [
    "Which cafe/space are we at? ☕",
    "What time are we starting?",
    "Count me in!",
    "See you there! 👋",
    "On my way! 💻",
  ],
  sunset: [
    "Best spot for sunset views? 🌅",
    "What time should we meet?",
    "Count me in!",
    "See you there! 👋",
  ],
  dance: [
    "Which club are we hitting? 💃",
    "What time does it start?",
    "Count me in!",
    "See you there! 👋",
  ],
};

export function GroupChatView({ 
  activityType, 
  city,
  homeCity,
  onBack, 
  attendeeCount = 0,
}: GroupChatViewProps) {
  const isCrossCity = homeCity && city !== homeCity;
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string; name: string | null; avatar_url: string | null }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { isMuted, toggleMute } = useActivityMute(city, activityType);
  const { leaveActivity } = useActivityJoins(city);
  
  const { canSendText, addCharacters } = useTextMessageLimit();
  
  // Get unique user IDs from messages for profile fetching
  const userIds = useMemo(() => {
    return [...new Set(messages.map((msg) => msg.user_id))];
  }, [messages]);
  
  const { profiles } = useUserProfiles(userIds);

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_type", activityType)
        .eq("city", city)
        .gt("expires_at", new Date().toISOString());

      if (joinsError || !joins?.length) {
        setParticipants([]);
        return;
      }

      const uniqueUserIds = [...new Set(joins.map((j) => j.user_id))];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", uniqueUserIds);

      const participantsList = uniqueUserIds.map((userId) => {
        const profile = profilesData?.find((p) => p.user_id === userId);
        return {
          user_id: userId,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      setParticipants(participantsList);
    };

    fetchParticipants();
  }, [activityType, city]);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Clear messages when activity type changes
  useEffect(() => {
    setMessages([]);
  }, [activityType, city]);

  // Fetch messages
  useEffect(() => {
    if (!activityType) return;

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
      .channel(`activity-messages-${activityType}-${city}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_messages",
          filter: `activity_type=eq.${activityType}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.city === city) {
            setMessages((prev) => [...prev, newMessage]);
            if (newMessage.user_id !== user?.id && !isMuted) {
              playNotificationSound();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_messages",
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityType, city, user?.id, isMuted]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update read status
  useEffect(() => {
    if (!user || !activityType) return;

    const updateReadStatus = async () => {
      await supabase
        .from("activity_read_status")
        .upsert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,activity_type,city"
        });
    };

    updateReadStatus();
    
    // Update when leaving
    return () => {
      updateReadStatus();
    };
  }, [user, activityType, city]);

  const handleSendMessage = useCallback(async () => {
    if (!user || isSending) return;
    
    // Check if there's something to send
    if (!message.trim()) return;

    // Check text limit for non-premium users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      return;
    }
    
    setIsSending(true);
    
    try {
      const messageText = message.trim();
      
      // Track character usage for free users
      if (!isPremium) {
        addCharacters(messageText.length);
      }
      
      const { error } = await supabase.from("activity_messages").insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
        message: messageText,
      });

      if (error) throw error;
      
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [user, isSending, message, isPremium, canSendText, activityType, city, addCharacters]);

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("activity_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleLeaveActivity = async () => {
    await leaveActivity(activityType);
    toast.success("Left the activity");
    onBack();
  };

  const handleMuteToggle = async () => {
    await toggleMute();
    toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formattedTime = format(currentTime, "EEEE, MMMM d • h:mm a");
  const title = `${getActivityEmoji(activityType)} ${getActivityLabel(activityType)}`;
  const { location, mapsUrl } = useActivityVenue(city, activityType);
  const showAttendees = attendeeCount > 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(50,40%,92%)] z-50">
      {/* Minimal Header */}
      <div className="flex items-center gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onBack} className="shrink-0 p-1 hover:opacity-70 transition-opacity">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-display text-black flex items-center gap-2">
            <span className="truncate">{title}</span>
            {isCrossCity && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full shrink-0">
                <Plane className="w-3 h-3" />
                {city}
              </span>
            )}
          </h1>
          <p className="text-sm text-black/60">{getActivityDay(activityType) || formattedTime}</p>
          {(activityType === "lunch" || activityType === "dinner" || activityType === "brunch") && (
            mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                📍 {location}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">📍 {location}</span>
            )
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleMuteToggle}
            className="shrink-0 text-black/50 hover:text-black hover:bg-black/10 h-8 w-8"
            title={isMuted ? "Unmute notifications" : "Mute notifications"}
          >
            {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLeaveActivity}
            className="shrink-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
            title="Leave activity"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Attendees section */}
      {showAttendees ? (
        <div className="w-full px-4 py-3 border-b border-black/5">
          <button 
            onClick={() => setShowParticipantsList(true)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex -space-x-2 overflow-hidden">
              {participants.slice(0, 6).map((participant) => (
                <div
                  key={participant.user_id}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-[hsl(50,40%,92%)] shrink-0"
                >
                  {participant.avatar_url ? (
                    <img
                      src={participant.avatar_url}
                      alt={participant.name || "User"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
              {participants.length > 6 && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border-2 border-[hsl(50,40%,92%)] text-xs font-medium text-muted-foreground shrink-0">
                  +{participants.length - 6}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} joined
            </p>
          </button>
        </div>
      ) : (
        <div className="w-full px-4 py-3 border-b border-black/5">
          <p className="text-sm text-muted-foreground/70">
            You're the first one here today!
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
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
                className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
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
                      className={`font-semibold text-sm text-black ${!isOwnMessage ? 'hover:underline cursor-pointer' : ''}`}
                      onClick={() => {
                        if (!isOwnMessage) {
                          setSelectedUserProfile({
                            userId: msg.user_id,
                            userName: profile?.name || null,
                            avatarUrl: profile?.avatar_url || null,
                          });
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
                    <div className={`text-sm mt-1 p-2 rounded-lg inline-block ${
                      isOwnMessage 
                        ? 'bg-black text-white'
                        : 'bg-blue-500 text-white'
                    }`}>
                      <span>{msg.message}</span>
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
      {user && !message.trim() && (
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {(chatSuggestions[activityType] || defaultSuggestions).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors border border-blue-500/20 whitespace-nowrap shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <Input
            placeholder={canSendText ? "Type a message..." : "Character limit reached"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-blue-500/10 border-blue-500/30 focus-visible:ring-blue-500/50 text-black placeholder:text-black/50"
            disabled={isSending || (!isPremium && !canSendText)}
          />
          <Button 
            variant="shake" 
            size="icon" 
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
          >
            {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
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
    </div>
  );
}
