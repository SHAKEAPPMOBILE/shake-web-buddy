import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Images, Camera, MoreVertical, LogOut, Ban, Trash2 } from "lucide-react";
import { UserProfileDialog } from "@/components/UserProfileDialog";
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

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢"];

type ReactionsMap = Record<string, Array<{ emoji: string; userIds: string[] }>>;

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
  const { messages, isLoading, sendMessage, markAsRead, deleteMessage } = usePrivateMessages(otherUserId);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [fetchedAvatar, setFetchedAvatar] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  // Reactions
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const [activeMsg, setActiveMsg] = useState<{ id: string; isMe: boolean; pickerY: number } | null>(null);

  // Long-press / double-tap refs
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const touchClientYRef = useRef<number>(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const { canSendText, addCharacters } = useTextMessageLimit();

  const chatSuggestions = useMemo(() => [
    t('chat.suggestions.hey', 'Hey! 👋'),
    t('chat.suggestions.howAreYou', 'How are you?'),
    t('chat.suggestions.niceToMeet', 'Nice to meet you!'),
    t('chat.suggestions.letsCatchUp', "Let's catch up!"),
    t('chat.suggestions.seeYouSoon', 'See you soon! 😊'),
  ], [t]);

  // Scroll to bottom on initial load and new messages (instant — no top-to-bottom animation)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages]);

  // Mark messages as read on mount
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // Fetch other user's profile if name/avatar not provided
  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(otherUserId)) return;
    if (otherUserName && otherUserName !== "Shaker") return;
    supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("user_id", otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setFetchedName(data.name);
        if (data?.avatar_url) setFetchedAvatar(data.avatar_url);
      });
  }, [otherUserId, otherUserName]);

  // Remove hidden record so the conversation reappears after re-opening
  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user || !UUID_RE.test(otherUserId)) return;
    supabase
      .from("private_conversation_hidden")
      .delete()
      .eq("user_id", user.id)
      .eq("other_user_id", otherUserId);
  }, [user?.id, otherUserId]);

  // Load reactions for current messages
  const messageIdsKey = messages.map(m => m.id).join(",");
  useEffect(() => {
    const ids = messagesRef.current.map(m => m.id);
    if (ids.length === 0) { setReactions({}); return; }
    supabase
      .from("private_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: ReactionsMap = {};
        for (const r of data) {
          if (!map[r.message_id]) map[r.message_id] = [];
          const existing = map[r.message_id].find(x => x.emoji === r.emoji);
          if (existing) existing.userIds.push(r.user_id);
          else map[r.message_id].push({ emoji: r.emoji, userIds: [r.user_id] });
        }
        setReactions(map);
      });
  }, [messageIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription for reactions
  useEffect(() => {
    if (!user || !otherUserId) return;
    const channel = supabase
      .channel(`private-reactions-${otherUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_message_reactions" }, () => {
        const ids = messagesRef.current.map(m => m.id);
        if (ids.length === 0) return;
        supabase
          .from("private_message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", ids)
          .then(({ data }) => {
            if (!data) return;
            const map: ReactionsMap = {};
            for (const r of data) {
              if (!map[r.message_id]) map[r.message_id] = [];
              const existing = map[r.message_id].find(x => x.emoji === r.emoji);
              if (existing) existing.userIds.push(r.user_id);
              else map[r.message_id].push({ emoji: r.emoji, userIds: [r.user_id] });
            }
            setReactions(map);
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, otherUserId]);

  const scrollMessagesToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // ── Long press / double tap handlers ─────────────────────────────────────

  const startLongPress = (msgId: string, isMe: boolean, clientY: number) => {
    touchClientYRef.current = clientY;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setActiveMsg({ id: msgId, isMe, pickerY: touchClientYRef.current });
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (msgId: string, isMe: boolean) => {
    cancelLongPress();
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    // Double-tap detection
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === msgId && now - last.time < 300) {
      lastTapRef.current = null;
      handleReaction(msgId, "❤️");
    } else {
      lastTapRef.current = { id: msgId, time: now };
    }
  };

  // ── Reaction toggle (one per user per message) ───────────────────────────

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setActiveMsg(null);

    const msgReactions = reactions[messageId] || [];
    // Find user's current reaction on this message (may be a different emoji)
    const userExisting = msgReactions.find(r => r.userIds.includes(user.id));
    const alreadyReactedSame = userExisting?.emoji === emoji;

    // Optimistic update: strip user from all emoji groups, then add to new one if not toggling off
    setReactions(prev => {
      const msgR = (prev[messageId] || [])
        .map(r => ({ ...r, userIds: r.userIds.filter(id => id !== user.id) }))
        .filter(r => r.userIds.length > 0);
      if (!alreadyReactedSame) {
        const idx = msgR.findIndex(r => r.emoji === emoji);
        if (idx !== -1) msgR[idx] = { ...msgR[idx], userIds: [...msgR[idx].userIds, user.id] };
        else msgR.push({ emoji, userIds: [user.id] });
      }
      return { ...prev, [messageId]: msgR };
    });

    // DB: always delete any existing reaction from this user first (enforces one-per-user)
    await supabase
      .from("private_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id);

    // Insert new reaction only if not toggling the same one off
    if (!alreadyReactedSame) {
      await supabase
        .from("private_message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  // ── Delete message ────────────────────────────────────────────────────────

  const handleDeleteMessage = async (messageId: string) => {
    setActiveMsg(null);
    const { error } = await deleteMessage(messageId);
    if (error) toast.error("Failed to delete message");
  };

  // ── Send / media handlers ─────────────────────────────────────────────────

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
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      throw new Error("Character limit reached");
    }
    setIsSending(true);
    const { error } = await sendMessage(url, "gif");
    setIsSending(false);
    if (error) { toast.error("Failed to send GIF"); throw error; }
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

  const displayName = (otherUserName && otherUserName !== "Shaker") ? otherUserName : (fetchedName || otherUserName || "Shaker");
  const rawAvatarUrl = (otherUserAvatar && !avatarError) ? otherUserAvatar : fetchedAvatar;
  const avatarUrl = avatarError ? null : (getDisplayAvatarUrl(rawAvatarUrl) ?? rawAvatarUrl);
  const initial = (displayName || "S").charAt(0).toUpperCase();

  return (
    <>
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0d0d1a" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3 border-b shrink-0" style={{ background: "#0d0d1a", borderColor: "rgba(255,255,255,0.08)", paddingTop: 'env(safe-area-inset-top)' }}>
        <MinimalBackButton onClick={onClose} className="text-white/70 border-white/20" />

        {/* Avatar → fullscreen photo. Name → opens profile. */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => avatarUrl && setShowFullPhoto(true)}
            className="w-9 h-9 rounded-full overflow-hidden border shrink-0 flex items-center justify-center"
            style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)" }}
            aria-label="View photo"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || "Shaker"}
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="text-sm font-bold" style={{ color: "#00C6B6" }}>{initial}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="flex-1 min-w-0 text-left"
            aria-label="View profile"
          >
            <h2 className="font-display text-lg text-white truncate">
              {displayName || "Shaker"}
            </h2>
          </button>
        </div>

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

              const msgReactions = reactions[msg.id] || [];

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
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  {/* Bubble row: trash icon sits beside the bubble for own messages */}
                  <div className={`flex items-end gap-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Trash icon — only for own messages, only when this msg is active */}
                  {isMe && activeMsg?.id === msg.id && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-50 hover:opacity-100 p-1 shrink-0 self-center"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  <div
                    className={`max-w-[80%] ${isMedia ? "shrink-0 overflow-visible" : "min-w-[60px] px-3 py-2 rounded-2xl"}`}
                    style={isMedia ? undefined : isMe ? outgoingBubble : incomingBubble}
                    onTouchStart={(e) => startLongPress(msg.id, isMe, e.touches[0].clientY)}
                    onTouchMove={cancelLongPress}
                    onTouchEnd={() => handleTouchEnd(msg.id, isMe)}
                    onContextMenu={(e) => { e.preventDefault(); setActiveMsg({ id: msg.id, isMe, pickerY: e.clientY }); }}
                  >
                    {isGif ? (
                      <>
                        <InlineChatGif src={msg.message} variant="dark" onLoad={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-white/40">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : isImage ? (
                      <>
                        <img src={msg.message} alt="shared image" className="rounded-2xl max-w-[260px] w-full object-cover" onLoad={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-white/40">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : isVideo ? (
                      <>
                        <video src={msg.message} controls playsInline preload="metadata" className="rounded-2xl max-w-[260px] w-full bg-black/30" onLoadedMetadata={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-white/40">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm break-words text-white">{msg.message}</p>
                        <p className="text-[10px] mt-1 text-white/50">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    )}
                  </div>
                  </div>{/* end bubble row */}

                  {/* Reaction pills */}
                  {msgReactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msgReactions.map(({ emoji, userIds }) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors"
                          style={
                            user && userIds.includes(user.id)
                              ? { background: "rgba(0,198,182,0.2)", borderColor: "rgba(0,198,182,0.5)", color: "white" }
                              : { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }
                          }
                        >
                          <span>{emoji}</span>
                          {userIds.length > 1 && <span className="ml-0.5">{userIds.length}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
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
            {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>

    {/* Reaction / action context menu — anchored above the long-pressed message */}
    {activeMsg && (
      <>
        <div className="fixed inset-0 z-[99998]" onClick={() => setActiveMsg(null)} />
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2"
          style={{ top: Math.max(60, activeMsg.pickerY - 100) }}
        >
          {/* Emoji picker row */}
          <div
            className="flex items-center gap-1 px-3 py-2.5 rounded-2xl shadow-2xl"
            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            {REACTION_EMOJIS.map((emoji) => {
              const reacted = user && (reactions[activeMsg.id] || [])
                .find(r => r.emoji === emoji)?.userIds.includes(user.id);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(activeMsg.id, emoji)}
                  className="text-2xl px-1 py-0.5 rounded-xl transition-transform active:scale-90 hover:scale-125"
                  style={reacted ? { background: "rgba(0,198,182,0.2)" } : undefined}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      </>
    )}

    <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    {user ? (
      <EventChatGiphyPickerModal
        open={giphyPickerOpen}
        onOpenChange={setGiphyPickerOpen}
        onGifSelect={handleGifSelect}
      />
    ) : null}
    <UserProfileDialog
      open={showProfile}
      onOpenChange={setShowProfile}
      userId={otherUserId}
      userName={displayName}
      avatarUrl={avatarUrl ?? null}
    />
    {showFullPhoto && avatarUrl && (
      <div
        className="fixed inset-0 z-[20000] bg-black/90 flex items-center justify-center"
        onClick={() => setShowFullPhoto(false)}
      >
        <img
          src={avatarUrl}
          alt={displayName || "Shaker"}
          className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
        />
      </div>
    )}
    </>
  );
}
