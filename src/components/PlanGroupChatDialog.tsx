import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, Trash2, Loader2, Mic } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AudioWaveform } from "@/components/AudioWaveform";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { useAudioMessageLimit } from "@/hooks/useAudioMessageLimit";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";

interface PlanGroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: UserActivity;
  onBack: () => void;
}

interface Message {
  id: string;
  activity_id: string;
  user_id: string;
  message: string;
  audio_url?: string | null;
  created_at: string;
}

const chatSuggestions = [
  "Hey everyone! 👋",
  "What time works for you?",
  "Where should we meet?",
  "Count me in!",
  "On my way! 🏃",
  "Running a bit late",
  "See you there!",
];

export function PlanGroupChatDialog({
  open,
  onOpenChange,
  activity,
  onBack,
}: PlanGroupChatDialogProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();
  const { showNotification } = usePushNotifications();
  const isWindowFocused = useRef(true);
  const isMobile = useIsMobile();
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  
  const { canSendAudio, remainingAudio, incrementAudioCount, FREE_AUDIO_LIMIT } = useAudioMessageLimit({
    conversationType: 'plan',
    conversationId: activity.id,
  });
  
  const { canSendText, addCharacters, remainingCharacters, FREE_CHARACTER_LIMIT } = useTextMessageLimit();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Track window focus
  useEffect(() => {
    const handleFocus = () => { isWindowFocused.current = true; };
    const handleBlur = () => { isWindowFocused.current = false; };
    
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Get unique user IDs from messages for profile fetching
  const userIds = useMemo(() => {
    return [...new Set(messages.map((msg) => msg.user_id))];
  }, [messages]);

  const { profiles } = useUserProfiles(userIds);

  // Fetch messages when dialog opens
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

    // Subscribe to message changes
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
        async (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          
          if (newMessage.user_id !== user?.id) {
            playNotificationSound();
            
            // Show browser notification if window is not focused
            if (!isWindowFocused.current) {
              // Get sender's name
              const { data: senderProfile } = await supabase
                .from("profiles")
                .select("name")
                .eq("user_id", newMessage.user_id)
                .single();
              
              const senderName = senderProfile?.name || "Someone";
              const activityLabel = getActivityLabel(activity.activity_type);
              const truncatedMessage = newMessage.message.length > 50
                ? newMessage.message.substring(0, 50) + "..."
                : newMessage.message;
              
              showNotification({
                title: `${senderName} in ${activityLabel}`,
                body: truncatedMessage,
                tag: `plan-msg-${newMessage.id}`,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "plan_messages",
          filter: `activity_id=eq.${activity.id}`,
        },
        (payload) => {
          const deletedMessage = payload.old as Message;
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedMessage.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, activity.id, user?.id]);

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
      
      if (!canSendAudio) {
        setShowPremiumDialog(true);
        toast.error(`You've reached the ${FREE_AUDIO_LIMIT} audio message limit. Upgrade to Super-Human for unlimited audio!`);
        return;
      }

      setIsSending(true);
      try {
        const fileName = `plans/${activity.id}/${user.id}/${Date.now()}.webm`;

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
          .from("plan_messages")
          .insert({
            activity_id: activity.id,
            user_id: user.id,
            message: "🎤 Voice note",
            audio_url: urlData.publicUrl,
          });

        if (messageError) throw messageError;

        setPendingAudio(null);
        incrementAudioCount();
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

    // Check text character limit for free users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      return;
    }

    setIsSending(true);

    const messageText = message.trim();
    const { error } = await supabase.from("plan_messages").insert({
      activity_id: activity.id,
      user_id: user.id,
      message: messageText,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } else {
      addCharacters(messageText.length);
      setMessage("");
      
      // Send SMS notification to plan owner (if not the owner sending)
      if (activity.user_id !== user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", user.id)
          .single();
        
        try {
          await supabase.functions.invoke("send-plan-sms", {
            body: {
              notificationType: "plan_message",
              activityId: activity.id,
              senderName: profile?.name || "Someone",
              messagePreview: messageText.substring(0, 50),
            },
          });
        } catch (smsError) {
          console.error("Failed to send SMS notification:", smsError);
        }
      }
    }

    setIsSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("plan_messages")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-lg h-[600px] flex flex-col p-0 bg-[hsl(50,40%,92%)] backdrop-blur-xl border-border/50 [&>button.dialog-close]:text-black"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {/* Header */}
        <DialogHeader className="p-4 border-b border-muted-foreground/20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 text-black hover:bg-black/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-display flex items-center gap-2 text-black">
                <span>{getActivityEmoji(activity.activity_type)}</span>
                <span className="truncate">{getActivityLabel(activity.activity_type)}</span>
              </DialogTitle>
              <p className="text-sm text-black/60 truncate">
                {activity.city} • {format(new Date(activity.scheduled_for), "EEE, MMM d")}
              </p>
              <button
                className="text-xs text-black/50 mt-0.5 hover:underline cursor-pointer text-left"
                onClick={() => {
                  setSelectedUserProfile({
                    userId: activity.user_id,
                    userName: activity.creator_name || null,
                    avatarUrl: activity.creator_avatar || null,
                  });
                }}
              >
                By {activity.creator_name}
              </button>
            </div>
            <button
              className="flex items-center gap-1 text-black/70 shrink-0 hover:text-black transition-colors"
              onClick={() => setShowParticipantsDialog(true)}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm">{activity.participant_count}</span>
            </button>
          </div>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
              <p className="text-center text-sm">
                Start the conversation!<br />
                Coordinate with other participants here.
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
                        {msg.audio_url ? (
                          <AudioWaveform audioUrl={msg.audio_url} isCompact />
                        ) : (
                          <span>{msg.message}</span>
                        )}
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
        {user && (
          <div className="px-4 py-2 border-t border-muted-foreground/20">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {chatSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 whitespace-nowrap transition-colors shrink-0 border border-blue-500/20"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio limit indicator for free users */}
        {user && !isPremium && (
          <div className="px-4 py-1 text-xs text-muted-foreground text-center">
            <span className="flex items-center justify-center gap-1">
              <Mic className="w-3 h-3" />
              {remainingAudio} / {FREE_AUDIO_LIMIT} voice notes remaining
            </span>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-muted-foreground/20">
          {pendingAudio ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-muted rounded-lg">
                <AudioWaveform audioUrl={pendingAudio.url} isCompact />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPendingAudio(null)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button onClick={handleSendMessage} disabled={isSending} className="bg-shake-green text-white hover:bg-shake-green/90">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <VoiceRecorder
                onAudioReady={(blob, url) => setPendingAudio({ blob, url })}
                onAudioClear={() => setPendingAudio(null)}
                disabled={!user}
                highlighted={true}
              />
              <Input
                placeholder={user ? (canSendText ? "Type a message..." : "Character limit reached") : "Sign in to chat"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!user || (!isPremium && !canSendText)}
                className="flex-1 bg-blue-500/10 border-blue-500/30 focus-visible:ring-blue-500/50"
              />
              <Button onClick={handleSendMessage} disabled={(!message.trim() && !pendingAudio) || isSending || !user} className="bg-shake-green text-white hover:bg-shake-green/90">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

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
    </Dialog>
  );
}