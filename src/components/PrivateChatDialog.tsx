import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Images, Camera, MoreVertical, LogOut, Ban } from "lucide-react";
import { usePrivateMessages } from "@/hooks/usePrivateMessages";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { toast } from "@/lib/app-toast";
import { LoadingSpinner } from "./LoadingSpinner";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { useTranslation } from "react-i18next";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { InlineChatGif } from "@/components/chat/InlineChatGif";
import { uploadChatMedia, getMediaMessageType, CHAT_MEDIA_MAX_SIZE_MB } from "@/lib/chatMediaUpload";
import { supabase } from "@/integrations/supabase/client";
import { MinimalBackButton } from "@/components/MinimalBackButton";

interface PrivateChatDialogProps {
  onClose: () => void;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  isActiveTab?: boolean;
}

export function PrivateChatDialog({
  onClose,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  isActiveTab = true,
}: PrivateChatDialogProps) {
  // Safety guard: never render if we're not on the chat tab
  if (!isActiveTab) return null;
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();
  const { messages, isLoading, sendMessage, markAsRead } = usePrivateMessages(otherUserId);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const { canSendText, addCharacters } = useTextMessageLimit();

  const chatSuggestions = useMemo(() => [
    t('chat.suggestions.hey', 'Hey! 👋'),
    t('chat.suggestions.howAreYou', 'How are you?'),
    t('chat.suggestions.niceToMeet', 'Nice to meet you!'),
    t('chat.suggestions.letsCatchUp', "Let's catch up!"),
    t('chat.suggestions.seeYouSoon', 'See you soon! 😊'),
  ], [t]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read on mount
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // Remove hidden record so the conversation reappears after re-opening
  useEffect(() => {
    if (!user) return;
    supabase
      .from("private_conversation_hidden")
      .delete()
      .eq("user_id", user.id)
      .eq("other_user_id", otherUserId);
  }, [user?.id, otherUserId]);

  const scrollMessagesToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending) return;

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

  const handleGifSelect = async (url: string) => {
    if (isSending) return;

    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error(
        "You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!"
      );
      throw new Error("Character limit reached");
    }

    setIsSending(true);
    const { error } = await sendMessage(url, "gif");
    setIsSending(false);

    if (error) {
      toast.error("Failed to send GIF");
      throw error;
    }
  };

  const handleMediaFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (e.target) e.target.value = "";

    if (file.size > CHAT_MEDIA_MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${CHAT_MEDIA_MAX_SIZE_MB}MB.`);
      return;
    }

    const mediaType = getMediaMessageType(file);
    setIsUploadingMedia(true);
    try {
      const publicUrl = await uploadChatMedia(file, user.id);
      const { error } = await sendMessage(publicUrl, mediaType);
      if (error) throw error;
    } catch (err) {
      console.error("Error uploading media:", err);
      toast.error("Failed to send media");
    } finally {
      setIsUploadingMedia(false);
    }
  }, [user, sendMessage]);

  const handleLeaveConversation = useCallback(async () => {
    if (!user) return;
    setShowMenu(false);
    const { error } = await supabase
      .from("private_conversation_hidden")
      .upsert({ user_id: user.id, other_user_id: otherUserId }, { onConflict: "user_id,other_user_id" });
    if (error) {
      toast.error("Failed to leave conversation");
    } else {
      toast.success("Conversation hidden");
      onClose();
    }
  }, [user, otherUserId, onClose]);

  const handleBlockUser = useCallback(async () => {
    if (!user) return;
    setShowMenu(false);
    await supabase.from("user_blocks").upsert(
      { blocker_id: user.id, blocked_id: otherUserId },
      { onConflict: "blocker_id,blocked_id" }
    );
    await supabase.from("private_conversation_hidden").upsert(
      { user_id: user.id, other_user_id: otherUserId },
      { onConflict: "user_id,other_user_id" }
    );
    toast.success("User blocked");
    onClose();
  }, [user, otherUserId, onClose]);

  const avatarUrl = avatarError ? null : (getDisplayAvatarUrl(otherUserAvatar) ?? otherUserAvatar);
  const initial = (otherUserName || "S").charAt(0).toUpperCase();

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0d0d1a" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pb-3 pt-4 border-b shrink-0" style={{ background: "#0d0d1a", borderColor: "rgba(255,255,255,0.08)" }}>
        <MinimalBackButton onClick={onClose} className="text-white/70 border-white/20" />
        <div className="w-9 h-9 rounded-full overflow-hidden border shrink-0 flex items-center justify-center" style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)" }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={otherUserName || "User"}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span className="text-sm font-bold" style={{ color: "#00C6B6" }}>{initial}</span>
          )}
        </div>
        <h2 className="font-display text-lg text-white flex-1 min-w-0 truncate">
          {otherUserName || "Shaker"}
        </h2>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu(v => !v)}
            className="p-2 rounded-full transition-colors hover:bg-white/10"
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5 text-white/60" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-xl z-50 overflow-hidden border" style={{ background: "#1a1a2e", borderColor: "rgba(255,255,255,0.12)" }}>
                <button
                  type="button"
                  onClick={handleLeaveConversation}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/80 hover:bg-white/10 transition-colors border-b"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <LogOut className="w-4 h-4 text-white/50" /> Leave conversation
                </button>
                <button
                  type="button"
                  onClick={handleBlockUser}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Ban className="w-4 h-4" /> Block user
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/50">{t('chat.noMessages', 'No messages yet.')}</p>
            <p className="text-xs mt-1 text-white/35">{t('chat.startConversation', 'Send a message to start the conversation!')}</p>
          </div>
        ) : (
          <div className="space-y-3 px-4">
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              const isGif = (msg.message_type ?? "text") === "gif" && /^https?:\/\//i.test(msg.message);
              const isImage = msg.message_type === "image" && /^https?:\/\//i.test(msg.message);
              const isVideo = msg.message_type === "video" && /^https?:\/\//i.test(msg.message);
              const isMedia = isGif || isImage || isVideo;

              // Bubble styles
              const incomingBubble: React.CSSProperties = {
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
              };
              const outgoingBubble: React.CSSProperties = {
                background: "rgba(0,198,182,0.18)",
                border: "1px solid rgba(0,198,182,0.25)",
              };

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] ${isMedia ? "shrink-0 overflow-visible" : "px-3 py-2 rounded-2xl"}`}
                    style={isMedia ? undefined : isMe ? outgoingBubble : incomingBubble}
                  >
                    {isGif ? (
                      <>
                        <InlineChatGif
                          src={msg.message}
                          variant="dark"
                          onLoad={scrollMessagesToBottom}
                        />
                        <p className="text-[10px] mt-1 text-white/40">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </>
                    ) : isImage ? (
                      <>
                        <img
                          src={msg.message}
                          alt="shared image"
                          className="rounded-2xl max-w-[260px] w-full object-cover"
                          onLoad={scrollMessagesToBottom}
                        />
                        <p className="text-[10px] mt-1 text-white/40">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </>
                    ) : isVideo ? (
                      <>
                        <video
                          src={msg.message}
                          controls
                          playsInline
                          preload="metadata"
                          className="rounded-2xl max-w-[260px] w-full bg-black/30"
                          onLoadedMetadata={scrollMessagesToBottom}
                        />
                        <p className="text-[10px] mt-1 text-white/40">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm break-words text-white">{msg.message}</p>
                        <p className="text-[10px] mt-1 text-white/50">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick suggestions - show when input is empty */}
      {user && !newMessage.trim() && !giphyPickerOpen && (
        <div className="shrink-0 px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {chatSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setNewMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input for media */}
      <input
        ref={mediaFileInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={handleMediaFileSelect}
      />

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 pb-safe-bottom pb-4 pt-2 border-t shrink-0" style={{ background: "#0d0d1a", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 hover:bg-white/10 text-white/60 hover:text-white"
            onClick={() => setGiphyPickerOpen(true)}
            disabled={!user || isSending || isUploadingMedia || giphyPickerOpen}
            aria-label="GIFs"
            title="GIFs"
          >
            <Images className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 hover:bg-white/10 text-white/60 hover:text-white"
            onClick={() => mediaFileInputRef.current?.click()}
            disabled={!user || isSending || isUploadingMedia || giphyPickerOpen}
            aria-label="Attach photo or video"
            title="Photo/Video"
          >
            {isUploadingMedia ? <LoadingSpinner size="sm" /> : <Camera className="w-5 h-5" />}
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={canSendText ? t('chat.typeMessage', 'Type a message...') : t('chat.characterLimitReached', 'Character limit reached')}
            className="flex-1 bg-white/8 border-white/15 text-white placeholder:text-white/35 focus-visible:ring-white/20"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "white" }}
            disabled={isSending || isUploadingMedia || (!isPremium && !canSendText) || giphyPickerOpen}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || isSending || isUploadingMedia || giphyPickerOpen}
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
    </div>
    <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    {user ? (
      <EventChatGiphyPickerModal
        open={giphyPickerOpen}
        onOpenChange={setGiphyPickerOpen}
        onGifSelect={handleGifSelect}
      />
    ) : null}
    </>
  );
}
