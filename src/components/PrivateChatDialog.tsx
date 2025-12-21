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
import { Send, User, Loader2 } from "lucide-react";
import { usePrivateMessages } from "@/hooks/usePrivateMessages";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

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
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, markAsRead } = usePrivateMessages(
    open ? otherUserId : null
  );
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    setIsSending(true);
    const { error } = await sendMessage(newMessage.trim());
    setIsSending(false);

    if (!error) {
      setNewMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 flex flex-col max-h-[80vh]">
        <DialogHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
              {otherUserAvatar ? (
                <img
                  src={otherUserAvatar}
                  alt={otherUserName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <DialogTitle className="font-display text-lg">
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
              <p className="text-xs mt-1">Say something to start the conversation!</p>
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
                          ? "bg-shake-yellow text-shake-dark rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm break-words">{msg.message}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isMe ? "text-shake-dark/60" : "text-muted-foreground"
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

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-border/50 pt-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={isSending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || isSending}
              className="bg-shake-yellow text-shake-dark hover:bg-shake-yellow/90"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
