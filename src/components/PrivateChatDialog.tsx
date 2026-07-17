import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Images, Camera, MoreVertical, LogOut, Ban, Trash2 } from "lucide-react";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { ChatInviteDialog } from "@/components/ChatInviteDialog";
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

  // ── First-time chat invite gate ──────────────────────────────────────────
  // "pending" = other person messaged first and I haven't accepted/declined yet.
  // While pending we show ChatInviteDialog instead of the message thread.
  const [inviteGate, setInviteGate] = useState<"checking" | "pending" | "clear">("checking");

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

  // Mark messages as read on mount — only once the invite gate (if any) has been cleared.
  useEffect(() => {
    if (inviteGate !== "clear") return;
    markAsRead();
  }, [markAsRead, inviteGate]);

  // ── Determine whether to show the invite gate ────────────────────────────
  // Gate applies when: they've messaged me, I've never replied, and I haven't
  // already accepted this invite. If I started the conversation, or I've ever
  // sent a message here, or I already accepted — skip straight to the chat.
  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user || !UUID_RE.test(otherUserId)) {
      setInviteGate("clear");
      return;
    }
    let cancelled = false;
    setInviteGate("checking");

    (async () => {
      const [{ count: sentCount }, { count: receivedCount }, { data: invite }] = await Promise.all([
        supabase
          .from("private_messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", user.id)
          .eq("receiver_id", otherUserId),
        supabase
          .from("private_messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", otherUserId)
          .eq("receiver_id", user.id),
        supabase
          .from("private_chat_invites")
          .select("status")
          .eq("user_id", user.id)
          .eq("other_user_id", otherUserId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const iHaveReplied = (sentCount || 0) > 0;
      const theyMessagedFirst = (receivedCount || 0) > 0;
      const alreadyAccepted = invite?.status === "accepted";

      const needsGate = !iHaveReplied && theyMessagedFirst && !alreadyAccepted;
      setInviteGate(needsGate ? "pending" : "clear");
    })().catch(() => {
      if (!cancelled) setInviteGate("clear"); // fail open — never block the chat on an error
    });

    return () => {
      cancelled = true;
    };
  }, [user, otherUserId]);

  // Fire-and-forget push telling the original sender how their chat request was answered.
  const notifyInviteResponse = useCallback(async (accepted: boolean) => {
    if (!user) return;
    try {
      const { data: myProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      const myName = myProfile?.name || "Someone";
      await supabase.functions.invoke("send-push-notification", {
        body: {
          to_user_id: otherUserId,
          title: accepted ? `${myName} accepted your chat request 🎉` : "Chat request update",
          body: accepted
            ? `You can chat with ${myName} now.`
            : `${myName} isn't available to chat right now.`,
          data: { tab: "chat", other_user_id: user.id },
        },
      });
    } catch {
      // Non-critical — never block the accept/decline flow on a push failure.
    }
  }, [user, otherUserId]);

  const handleAcceptInvite = useCallback(async () => {
    if (!user) return;
    setInviteGate("clear");
    await supabase
      .from("private_chat_invites")
      .upsert(
        { user_id: user.id, other_user_id: otherUserId, status: "accepted", responded_at: new Date().toISOString() },
        { onConflict: "user_id,other_user_id" }
      );
    void notifyInviteResponse(true);
  }, [user, otherUserId, notifyInviteResponse]);

  const handleDeclineInvite = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      supabase
        .from("private_chat_invites")
        .upsert(
          { user_id: user.id, other_user_id: otherUserId, status: "declined", responded_at: new Date().toISOString() },
          { onConflict: "user_id,other_user_id" }
        ),
      supabase
        .from("private_conversation_hidden")
        .upsert({ user_id: user.id, other_user_id: otherUserId }, { onConflict: "user_id,other_user_id" }),
    ]);
    void notifyInviteResponse(false);
    toast.success(t("chatInvite.declinedToast", "Request removed"));
    onClose();
  }, [user, otherUserId, onClose, t, notifyInviteResponse]);

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
    if (error) toast.error(t('chat.failedToDeleteMessage'));
  };

  // ── Send / media handlers ─────────────────────────────────────────────────

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error(t('chat.characterLimitToast'));
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
      toast.error(t('chat.characterLimitToast'));
      throw new Error("Character limit reached");
    }
    setIsSending(true);
    const { error } = await sendMessage(url, "gif");
    setIsSending(false);
    if (error) { toast.error(t('chat.failedToSendGif')); throw error; }
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
      toast.error(t('chat.failedToSendMedia'));
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
      toast.error(t('chat.failedToLeaveConversation'));
    } else {
      toast.success(t('chat.conversationHidden'));
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
    toast.success(t('chat.userBlocked'));
    onClose();
  }, [user, otherUserId, onClose]);

  const displayName = (otherUserName && otherUserName !== "Shaker") ? otherUserName : (fetchedName || otherUserName || "Shaker");
  const rawAvatarUrl = (otherUserAvatar && !avatarError) ? otherUserAvatar : fetchedAvatar;
  const avatarUrl = avatarError ? null : (getDisplayAvatarUrl(rawAvatarUrl) ?? rawAvatarUrl);
  const photoUrl = otherUserAvatar || fetchedAvatar || avatarUrl;
  const initial = (displayName || "S").charAt(0).toUpperCase();

  // Still checking whether this is a first-time unanswered chat — avoid a flash of the thread.
  if (inviteGate === "checking") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "hsl(50,40%,92%)" }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // First time opening a chat someone else started — show the invite card instead of the thread.
  if (inviteGate === "pending") {
    return (
      <div className="fixed inset-0 z-[9999]" style={{ background: "hsl(50,40%,92%)" }}>
        <ChatInviteDialog
          userName={displayName}
          avatarUrl={avatarUrl ?? null}
          onDismiss={onClose}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
        />
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "hsl(50,40%,92%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3 border-b shrink-0" style={{ background: "hsl(50,40%,92%)", borderColor: "rgba(0,0,0,0.08)", paddingTop: 'env(safe-area-inset-top)' }}>
        <MinimalBackButton onClick={onClose} className="text-gray-600 border-gray-300" />

        {/* Avatar → fullscreen photo. Name → opens profile. */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              const url = otherUserAvatar || fetchedAvatar || avatarUrl;
              console.log('[PHOTO TAP] url:', url);
              if (url) setShowFullPhoto(true);
            }}
            className="w-9 h-9 rounded-full overflow-hidden border shrink-0 flex items-center justify-center"
            style={{ borderColor: "rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.05)" }}
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
            <h2 className="font-display text-lg text-gray-900 truncate">
              {displayName || "Shaker"}
            </h2>
          </button>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu(v => !v)}
            className="p-2 rounded-full transition-colors hover:bg-black/10"
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-xl z-50 overflow-hidden border" style={{ background: "white", borderColor: "rgba(0,0,0,0.10)" }}>
                <button
                  type="button"
                  onClick={handleLeaveConversation}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-b"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  <LogOut className="w-4 h-4 text-gray-400" /> Leave conversation
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
            <p className="text-sm text-gray-500">{t('chat.noMessages', 'No messages yet.')}</p>
            <p className="text-xs mt-1 text-gray-400">{t('chat.startConversation', 'Send a message to start the conversation!')}</p>
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
                background: "white",
                border: "1px solid rgba(0,0,0,0.08)",
              };
              const outgoingBubble: React.CSSProperties = {
                background: "#00C6B6",
                border: "1px solid rgba(0,198,182,0.4)",
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
                    className={`max-w-[80%] ${isMedia ? "shrink-0 overflow-visible" : "min-w-[100px] px-3 py-2 rounded-2xl"}`}
                    style={isMedia ? undefined : isMe ? outgoingBubble : incomingBubble}
                    onTouchStart={(e) => startLongPress(msg.id, isMe, e.touches[0].clientY)}
                    onTouchMove={cancelLongPress}
                    onTouchEnd={() => handleTouchEnd(msg.id, isMe)}
                    onContextMenu={(e) => { e.preventDefault(); setActiveMsg({ id: msg.id, isMe, pickerY: e.clientY }); }}
                  >
                    {isGif ? (
                      <>
                        <InlineChatGif src={msg.message} variant="dark" onLoad={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-gray-400">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : isImage ? (
                      <>
                        <img src={msg.message} alt="shared image" className="rounded-2xl max-w-[260px] w-full object-cover" onLoad={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-gray-400">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : isVideo ? (
                      <>
                        <video src={msg.message} controls playsInline preload="metadata" className="rounded-2xl max-w-[260px] w-full bg-black/30" onLoadedMetadata={scrollMessagesToBottom} />
                        <p className="text-[10px] mt-1 text-gray-400">{format(new Date(msg.created_at), "HH:mm")}</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm break-words ${isMe ? "text-white" : "text-gray-900"}`}>{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-gray-400"}`}>{format(new Date(msg.created_at), "HH:mm")}</p>
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
                              ? { background: "rgba(0,198,182,0.2)", borderColor: "rgba(0,198,182,0.5)", color: "#0d9488" }
                              : { background: "rgba(0,0,0,0.05)", borderColor: "rgba(0,0,0,0.12)", color: "#374151" }
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
                  background: "rgba(0,0,0,0.05)",
                  border: "1px solid rgba(0,0,0,0.10)",
                  color: "#374151",
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
      <form onSubmit={handleSend} className="px-4 pb-safe-bottom pb-4 pt-2 border-t shrink-0" style={{ background: "hsl(50,40%,92%)", borderColor: "rgba(0,0,0,0.08)" }}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 hover:bg-black/10 text-gray-500 hover:text-gray-900"
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
            className="shrink-0 h-9 w-9 hover:bg-black/10 text-gray-500 hover:text-gray-900"
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
            className="flex-1 text-gray-900 placeholder:text-gray-400 focus-visible:ring-gray-300"
            style={{ background: "white", borderColor: "rgba(0,0,0,0.15)", color: "#111827" }}
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
            style={{ background: "white", border: "1px solid rgba(0,0,0,0.10)" }}
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
    {showFullPhoto && photoUrl && (
      <div
        className="fixed inset-0 z-[20000] bg-black/90 flex items-center justify-center"
        onClick={() => setShowFullPhoto(false)}
      >
        <img
          src={photoUrl}
          alt={displayName || "Shaker"}
          className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
        />
      </div>
    )}
    </>
  );
}
