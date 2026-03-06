import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, Trash2, MapPin, Calendar, Clock, FileText } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { LoadingSpinner } from "./LoadingSpinner";
import { getActivityLabel, getActivityEmoji } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";

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

interface PlanGroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  onBack: () => void;
  attendeeCount?: number;
}

const chatSuggestions = [
  "What time works best?",
  "Where should we meet?",
  "Count me in!",
  "See you there! 👋",
  "I'm running late!",
  "On my way! 🏃",
];

export function PlanGroupChatDialog({
  open,
  onOpenChange,
  activity,
  onBack,
  attendeeCount = 0,
}: PlanGroupChatDialogProps) {
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
  const [participants, setParticipants] = useState<{ user_id: string; name: string | null; avatar_url: string | null }[]>([]);
  
  const { canSendText, addCharacters } = useTextMessageLimit();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { location, mapsUrl } = useActivityVenue(activity.city, activity.activity_type);
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

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

  // Fetch participants (creator + joined users)
  useEffect(() => {
    if (!open || !activity.id) return;

    const fetchParticipants = async () => {
      // Get activity joins for this activity
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id)
        .gt("expires_at", new Date().toISOString());

      // Collect unique user IDs (creator + joiners)
      const participantUserIds = [activity.user_id];
      if (joins && !joinsError) {
        joins.forEach((j) => {
          if (!participantUserIds.includes(j.user_id)) {
            participantUserIds.push(j.user_id);
          }
        });
      }

      // Fetch profiles for all participants
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", participantUserIds);

      const participantsList = participantUserIds.map((userId) => {
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

    // Subscribe to activity_joins changes for this activity
    const channel = supabase
      .channel(`plan-participants-${activity.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_joins",
          filter: `activity_id=eq.${activity.id}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, activity.id, activity.user_id]);

  // Fetch messages
  useEffect(() => {
    if (!open || !activity.id) return;

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
  }, [open, activity.id, user?.id]);

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

  const scheduledDate = new Date(activity.scheduled_for);
  const formattedDate = format(scheduledDate, "EEEE, MMMM d");
  const formattedTime = format(scheduledDate, "h:mm a");
  const creatorProfile = profiles[activity.user_id];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg flex flex-col p-0 bg-[hsl(50,40%,92%)] backdrop-blur-xl border-border/50 [&>button.dialog-close]:text-black h-[600px]"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0">
          <button onClick={onBack} className="p-1 hover:bg-muted rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-foreground truncate">
              {getActivityEmoji(activity.activity_type)} {getActivityLabel(activity.activity_type)}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              Created by {creatorProfile?.name || "Shaker"}
            </p>
          </div>
          {/* Participant avatars or count */}
          <button
            onClick={() => setShowParticipantsDialog(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors"
          >
            {participants.length > 0 ? (
              <>
                <div className="flex -space-x-1.5">
                  {participants.slice(0, 4).map((p) => (
                    <div
                      key={p.user_id}
                      className="w-5 h-5 rounded-full bg-muted border border-white overflow-hidden"
                    >
                      {p.avatar_url ? (
                        <img src={getDisplayAvatarUrl(p.avatar_url) ?? p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <User className="w-2.5 h-2.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <span>{attendeeCount > 0 ? attendeeCount : participants.length}</span>
              </>
            ) : (
              <>
                <Users className="w-3 h-3" />
                <span>{attendeeCount}</span>
              </>
            )}
          </button>
        </div>

        {/* Activity Details Card */}
        <div className="mx-4 mt-3 p-3 bg-white/50 rounded-lg border border-border/30 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
            <Clock className="w-4 h-4 ml-2" />
            <span>{formattedTime}</span>
          </div>
          {(activity.activity_type === "lunch" || activity.activity_type === "dinner" || activity.activity_type === "brunch") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {location}
                </a>
              ) : (
                <span>{location}</span>
              )}
            </div>
          )}
          {activity.note && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4 mt-0.5" />
              <span>{activity.note}</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
              <p className="text-center text-sm">
                Start planning!<br />
                Coordinate with others joining this plan.
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
                    className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-border"
                    disabled={isOwnMessage}
                  >
                    <Avatar className="w-full h-full rounded-full bg-muted">
                      <AvatarImage src={avatarUrl ?? undefined} alt={displayName} className="object-cover" />
                      <AvatarFallback className="bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
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
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder={user ? (canSendText ? "Type a message..." : "Character limit reached") : "Sign in to chat"}
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
      </DialogContent>
    </Dialog>
  );
}
