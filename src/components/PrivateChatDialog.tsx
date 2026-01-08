import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, Loader2, Mic, Lock } from "lucide-react";
import { usePrivateMessages } from "@/hooks/usePrivateMessages";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioMessageLimit } from "@/hooks/useAudioMessageLimit";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrivateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
}

const chatSuggestions = [
  "Hey! 👋",
  "How are you?",
  "Nice to meet you!",
  "Let's catch up!",
  "See you soon! 😊",
];

export function PrivateChatDialog({
  open,
  onOpenChange,
  otherUserId,
  otherUserName,
  otherUserAvatar,
}: PrivateChatDialogProps) {
  const { user, isPremium } = useAuth();
  const { messages, isLoading, sendMessage, markAsRead } = usePrivateMessages(
    open ? otherUserId : null
  );
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const { canSendAudio, remainingAudio, incrementAudioCount, FREE_AUDIO_LIMIT } = useAudioMessageLimit({
    conversationType: 'private',
    conversationId: otherUserId,
  });
  
  const { canSendText, addCharacters, remainingCharacters, FREE_CHARACTER_LIMIT } = useTextMessageLimit();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when opening
  useEffect(() => {
    if (open) {
      markAsRead();
    }
  }, [open, markAsRead]);

  const handleSendAudio = async () => {
    if (!pendingAudio || !user) return;
    
    if (!canSendAudio) {
      setShowPremiumDialog(true);
      toast.error(`You've reached the ${FREE_AUDIO_LIMIT} audio message limit. Upgrade to Super-Human for unlimited audio!`);
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

      const { error } = await sendMessage("🎤 Voice note", urlData.publicUrl);
      
      if (!error) {
        setPendingAudio(null);
        incrementAudioCount();
        toast.success("Voice note sent!");
      }
    } catch (error) {
      console.error("Error sending voice note:", error);
      toast.error("Failed to send voice note");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Handle audio message
    if (pendingAudio) {
      await handleSendAudio();
      return;
    }
    
    if (!newMessage.trim() || isSending) return;

    // Check text character limit for free users
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      return;
    }

    setIsSending(true);
    const { error } = await sendMessage(newMessage.trim());
    setIsSending(false);

    if (!error) {
      addCharacters(newMessage.trim().length);
      setNewMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-[hsl(50,40%,92%)] backdrop-blur-xl border-border/50 flex flex-col max-h-[80vh] [&>button.dialog-close]:text-black"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader className="border-b border-black/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-black/20 shadow-sm">
              {otherUserAvatar ? (
                <img
                  src={otherUserAvatar}
                  alt={otherUserName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-black/60" />
              )}
            </div>
            <DialogTitle className="font-display text-lg text-black">
              {otherUserName || "Shaker"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 py-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs mt-1">Send a voice note to start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3 px-1">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                        isMe
                          ? "bg-black text-white rounded-br-sm"
                          : "bg-blue-500 text-white rounded-bl-sm"
                      }`}
                    >
                      {msg.audio_url ? (
                        <AudioWaveform audioUrl={msg.audio_url} isCompact />
                      ) : (
                        <p className="text-sm break-words">{msg.message}</p>
                      )}
                      <p
                        className={`text-[10px] mt-1 ${
                          isMe ? "text-white/60" : "text-white/60"
                        }`}
                      >
                        {format(new Date(msg.created_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Quick suggestions for free users */}
        {user && !isPremium && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {chatSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setNewMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground whitespace-nowrap transition-colors shrink-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio limit indicator for free users */}
        {user && !isPremium && (
          <div className="px-4 py-1 text-xs text-muted-foreground text-center border-t border-border/50">
            <span className="flex items-center justify-center gap-1">
              <Mic className="w-3 h-3" />
              {remainingAudio} / {FREE_AUDIO_LIMIT} voice notes remaining
            </span>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-border/50 pt-4 px-4 pb-4">
          {pendingAudio ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-muted rounded-lg">
                <AudioWaveform audioUrl={pendingAudio.url} isCompact />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPendingAudio(null)}>
                <Lock className="w-4 h-4" />
              </Button>
              <Button 
                type="button"
                onClick={handleSendAudio}
                disabled={isSending}
                variant="shake"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <VoiceRecorder
                onAudioReady={(blob, url) => setPendingAudio({ blob, url })}
                onAudioClear={() => setPendingAudio(null)}
                disabled={isSending}
                highlighted={true}
              />
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={canSendText ? "Type a message..." : "Character limit reached"}
                className="flex-1"
                disabled={isSending || (!isPremium && !canSendText)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={(!newMessage.trim() && !pendingAudio) || isSending}
                variant="shake"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
      
      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </Dialog>
  );
}
