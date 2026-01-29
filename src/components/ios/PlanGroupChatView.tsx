import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Users, User, Trash2, MapPin, FileText } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityVenue } from "@/contexts/VenueContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { LoadingSpinner } from "../LoadingSpinner";
import { getActivityLabel, getActivityEmoji } from "@/data/activityTypes";
import { useTranslation } from "react-i18next";

interface PlanMessage {
  id: string;
  activity_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface Activity {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string;
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanGroupChatViewProps {
  activity: Activity;
  onBack: () => void;
  attendeeCount?: number;
}

export function PlanGroupChatView({
  activity,
  onBack,
  attendeeCount = 0,
}: PlanGroupChatViewProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  
  const { canSendText, addCharacters } = useTextMessageLimit();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { location, mapsUrl } = useActivityVenue(activity.city, activity.activity_type);

  const chatSuggestions = useMemo(() => [
    t('chat.suggestions.whatTime', 'What time works best?'),
    t('chat.suggestions.whereMeet', 'Where should we meet?'),
    t('chat.suggestions.countMeIn', 'Count me in!'),
    t('chat.suggestions.seeYouThere', 'See you there! 👋'),
    t('chat.suggestions.runningLate', "I'm running late!"),
    t('chat.suggestions.onMyWay', 'On my way! 🏃'),
  ], [t]);

  // Get unique user IDs from messages
  const userIds = useMemo(() => {
    const ids = [...new Set(messages.map((msg) => msg.user_id))];
    // Also include activity creator
    if (!ids.includes(activity.user_id)) {
      ids.push(activity.user_id);
    }
    return ids;
  }, [messages, activity.user_id]);

  const { profiles } = useUserProfiles(userIds);

  // Fetch messages
  useEffect(() => {
    if (!activity.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("plan_messages")
        .select("*")
        .eq("activity_id", activity.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching plan messages:", error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`plan-messages-${activity.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `activity_id=eq.${activity.id}`,
        },
        (payload) => {
          const newMessage = payload.new as PlanMessage;
          setMessages((prev) => [...prev, newMessage]);
          // Play notification sound for messages from others
          if (newMessage.user_id !== user?.id) {
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "plan_messages",
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activity.id, user?.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || isSending) return;

    // Check text character limit for free users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      return;
    }

    setIsSending(true);

    try {
      const { error } = await supabase.from("plan_messages").insert({
        activity_id: activity.id,
        user_id: user.id,
        message: message.trim(),
      });

      if (error) throw error;

      addCharacters(message.trim().length);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("plan_messages").delete().eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const creatorProfile = profiles[activity.user_id];

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(50,40%,92%)] z-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onBack} className="shrink-0 p-1 hover:opacity-70 transition-opacity">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        
        {/* Creator Avatar */}
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-black/20 shadow-sm shrink-0">
          {creatorProfile?.avatar_url ? (
            <img
              src={creatorProfile.avatar_url}
              alt={creatorProfile?.name || "Creator"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg">{getActivityEmoji(activity.activity_type)}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-display text-black truncate">
            {activity.note || t('plans.untitledPlan', 'Untitled Plan')}
          </h1>
          <p className="text-sm text-black/60 truncate">
            {t('chat.createdBy', 'Created by')}{' '}
            <button
              type="button"
              onClick={() => {
                setSelectedUserProfile({
                  userId: activity.user_id,
                  userName: creatorProfile?.name || null,
                  avatarUrl: creatorProfile?.avatar_url || null,
                });
              }}
              className="underline hover:text-black/80 transition-colors font-medium"
            >
              {creatorProfile?.name || "Shaker"}
            </button>
          </p>
        </div>
        <button
          onClick={() => setShowParticipantsDialog(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors"
        >
          <Users className="w-3 h-3" />
          <span>{attendeeCount}</span>
        </button>
      </div>


      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
            <p className="text-center text-sm">
              {t('chat.startPlanning', 'Start planning!')}<br />
              {t('chat.coordinateWithOthers', 'Coordinate with others joining this plan.')}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === user?.id;
            const profile = profiles[msg.user_id];
            const displayName = isOwnMessage ? "You" : profile?.name || "Shaker";
            const avatarUrl = profile?.avatar_url;

            return (
              <div
                key={msg.id}
                className={`group flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
              >
                <button
                  onClick={() => {
                    if (!isOwnMessage) {
                      setSelectedUserProfile({
                        userId: msg.user_id,
                        userName: profile?.name || null,
                        avatarUrl: profile?.avatar_url || null,
                      });
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0 overflow-hidden border border-border"
                  disabled={isOwnMessage}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <div className={`flex-1 max-w-[70%] ${isOwnMessage ? "text-right" : ""}`}>
                  <div className={`flex items-baseline gap-2 ${isOwnMessage ? "justify-end" : ""}`}>
                    <button
                      className={`font-semibold text-sm text-black ${!isOwnMessage ? "hover:underline cursor-pointer" : ""}`}
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
                      {format(new Date(msg.created_at), "h:mm a")}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`text-sm mt-1 p-2 rounded-lg inline-block ${
                        isOwnMessage
                          ? "bg-black text-white"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      <span>{msg.message}</span>
                    </div>
                    {isOwnMessage && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
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

      {/* Quick suggestions */}
      {user && !message.trim() && (
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {chatSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors border border-blue-500/20 whitespace-nowrap shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <Input
            placeholder={user ? (canSendText ? t('chat.typeMessage', 'Type a message...') : t('chat.characterLimitReached', 'Character limit reached')) : t('chat.signInToChat', 'Sign in to chat')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!user || (!isPremium && !canSendText)}
            className="flex-1 bg-blue-500/10 border-blue-500/30 focus-visible:ring-blue-500/50 text-black placeholder:text-black/50"
          />
          <Button onClick={handleSendMessage} disabled={!message.trim() || isSending || !user} variant="shake">
            {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* User Profile Dialog */}
      {selectedUserProfile && (
        <UserProfileDialog
          open={!!selectedUserProfile}
          onOpenChange={() => setSelectedUserProfile(null)}
          userId={selectedUserProfile.userId}
          userName={selectedUserProfile.userName}
          avatarUrl={selectedUserProfile.avatarUrl}
        />
      )}

      {/* Participants List Dialog */}
      <PlanParticipantsDialog
        open={showParticipantsDialog}
        onOpenChange={setShowParticipantsDialog}
        activity={activity}
        onViewProfile={(userId, userName, avatarUrl) => {
          setShowParticipantsDialog(false);
          setSelectedUserProfile({ userId, userName, avatarUrl });
        }}
      />
      
      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </div>
  );
}
