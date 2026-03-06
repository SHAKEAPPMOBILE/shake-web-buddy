import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User } from "lucide-react";
import { usePrivateMessages } from "@/hooks/usePrivateMessages";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { toast } from "sonner";
import { LoadingSpinner } from "./LoadingSpinner";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { useTranslation } from "react-i18next";

interface PrivateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
}

export function PrivateChatDialog({
  open,
  onOpenChange,
  otherUserId,
  otherUserName,
  otherUserAvatar,
}: PrivateChatDialogProps) {
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();
  const { messages, isLoading, sendMessage, markAsRead } = usePrivateMessages(
    open ? otherUserId : null
  );
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const { canSendText, addCharacters } = useTextMessageLimit();
  
  const chatSuggestions = useMemo(() => [
    t('chat.suggestions.hey', 'Hey! 👋'),
    t('chat.suggestions.howAreYou', 'How are you?'),
    t('chat.suggestions.niceToMeet', 'Nice to meet you!'),
    t('chat.suggestions.letsCatchUp', "Let's catch up!"),
    t('chat.suggestions.seeYouSoon', 'See you soon! 😊'),
  ], [t]);
  
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-black/20 shadow-sm">
              {otherUserAvatar ? (
                <img
                  src={getDisplayAvatarUrl(otherUserAvatar) ?? otherUserAvatar}
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
              <LoadingSpinner size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('chat.noMessages', 'No messages yet.')}</p>
              <p className="text-xs mt-1">{t('chat.startConversation', 'Send a message to start the conversation!')}</p>
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
                      <p className="text-sm break-words">{msg.message}</p>
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

        {/* Quick suggestions - show when input is empty */}
        {user && !newMessage.trim() && (
          <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 w-max">
              {chatSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setNewMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors border border-blue-500/20 whitespace-nowrap shrink-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="pt-4 px-4 pb-4">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={canSendText ? t('chat.typeMessage', 'Type a message...') : t('chat.characterLimitReached', 'Character limit reached')}
              className="flex-1"
              disabled={isSending || (!isPremium && !canSendText)}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || isSending}
              variant="shake"
            >
              {isSending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </Dialog>
  );
}
