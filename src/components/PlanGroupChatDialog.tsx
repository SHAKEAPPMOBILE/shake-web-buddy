import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, User, Trash2, Calendar, Smile, X, Images } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { playNotificationSound } from "@/lib/notification-sound";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { LoadingSpinner } from "./LoadingSpinner";
import { getActivityLabel, getActivityEmoji } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { InlineChatGif } from "@/components/chat/InlineChatGif";

interface PlanMessage {
  id: string;
  activity_id: string;
  user_id: string;
  message: string;
  message_type?: string | null;
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
  image_url?: string | null;
  title?: string | null;
}

interface PlanGroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  onBack: () => void;
  attendeeCount?: number;
}

const CHAT_SUGGESTIONS = [
  "What time works best?",
  "Where should we meet?",
  "Count me in!",
  "See you there! 👋",
  "I'm running late!",
  "On my way! 🏃",
];

const STICKER_PACKS = [
  { label: "Fun", stickers: ["🎉", "🎊", "🥳", "🎈", "🎁", "🎆", "✨", "💫", "🎯", "🏆"] },
  { label: "Love", stickers: ["❤️", "🧡", "💛", "💚", "💙", "💜", "💕", "💞", "🫶", "🥰"] },
  { label: "Vibe", stickers: ["🔥", "💯", "⭐", "🌈", "🌊", "🌟", "👏", "🙌", "💪", "🤩"] },
  { label: "Activity", stickers: ["🍕", "🍺", "☕", "🏃", "🧘", "🏊", "🎸", "⚽", "🏀", "🤝"] },
];

const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\p{Emoji}\u200d\ufe0f\s]+$/u;
function isSticker(msg: string): boolean {
  const trimmed = msg.trim();
  if (!trimmed) return false;
  const chars = [...trimmed].filter(c => c.trim());
  return EMOJI_ONLY_RE.test(trimmed) && chars.length <= 4;
}

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
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeStickerPack, setActiveStickerPack] = useState(0);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [participants, setParticipants] = useState<{ user_id: string; name: string | null; avatar_url: string | null }[]>([]);

  const { canSendText, addCharacters } = useTextMessageLimit();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, isPremium } = useAuth();

  const userIds = useMemo(() => {
    const ids = [...new Set(messages.map((msg) => msg.user_id))];
    if (!ids.includes(activity.user_id)) ids.push(activity.user_id);
    return ids;
  }, [messages, activity.user_id]);

  const { profiles } = useUserProfiles(userIds);

  const ownProfile = user ? profiles[user.id] : null;

  useEffect(() => {
    if (!open || !activity.id) return;

    const fetchParticipants = async () => {
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id)
        .gt("expires_at", new Date().toISOString());

      const participantUserIds = [activity.user_id];
      if (joins && !joinsError) {
        joins.forEach((j) => {
          if (!participantUserIds.includes(j.user_id)) participantUserIds.push(j.user_id);
        });
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", participantUserIds);

      setParticipants(
        participantUserIds.map((userId) => {
          const profile = profilesData?.find((p) => p.user_id === userId);
          return { user_id: userId, name: profile?.name || null, avatar_url: profile?.avatar_url || null };
        })
      );
    };

    fetchParticipants();

    const channel = supabase
      .channel(`plan-participants-${activity.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_joins", filter: `activity_id=eq.${activity.id}` }, fetchParticipants)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, activity.id, activity.user_id]);

  useEffect(() => {
    if (!open || !activity.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("plan_messages")
        .select("*")
        .eq("activity_id", activity.id)
        .order("created_at", { ascending: true });
      if (!error) setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`plan-messages-${activity.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "plan_messages", filter: `activity_id=eq.${activity.id}` },
        (payload) => {
          const newMsg = payload.new as PlanMessage;
          setMessages((prev) => [...prev, newMsg]);
          if (newMsg.user_id !== user?.id) playNotificationSound();
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "plan_messages" },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, activity.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open) {
      setShowStickerPicker(false);
      setGiphyPickerOpen(false);
      setMessage("");
    }
  }, [open]);

  const insertPlanMessage = async (text: string, messageType: "text" | "gif" = "text") => {
    if (!text.trim() || !user || isSending) return false;
    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      return false;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.from("plan_messages").insert({
        activity_id: activity.id,
        user_id: user.id,
        message: text.trim(),
        message_type: messageType,
      });
      if (error) throw error;
      if (messageType === "text") addCharacters(text.trim().length);
      return true;
    } catch {
      toast.error("Failed to send message");
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    const ok = await insertPlanMessage(message, "text");
    if (ok) setMessage("");
  };

  const handleSendSticker = async (sticker: string) => {
    const ok = await insertPlanMessage(sticker, "text");
    if (ok) {
      setShowStickerPicker(false);
      inputRef.current?.focus();
    }
  };

  const handleGifSelect = async (url: string) => {
    const ok = await insertPlanMessage(url, "gif");
    if (!ok) throw new Error("Failed to send GIF");
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("plan_messages").delete().eq("id", messageId);
    if (error) toast.error("Failed to delete message");
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
  const emoji = getActivityEmoji(activity.activity_type);
  const label = activity.title || getActivityLabel(activity.activity_type);
  const creatorProfile = profiles[activity.user_id];
  const displayAttendeeCount = attendeeCount > 0 ? attendeeCount : participants.length;

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-[#06060a] overflow-hidden" style={{ animation: "slideInFromRight 0.25s ease-out" }}>
      {/* Purple / pink radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 8% 0%, rgba(139,92,246,0.55) 0%, transparent 50%), " +
            "radial-gradient(circle at 92% 12%, rgba(236,72,153,0.45) 0%, transparent 50%), " +
            "radial-gradient(circle at 50% 100%, rgba(56,189,248,0.35) 0%, transparent 55%)",
        }}
        aria-hidden
      />

      {/* ── EVENT HEADER ── */}
      <div className="relative z-10 shrink-0">
        {/* Top bar: back + participants */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => { onOpenChange(false); onBack(); }}
            className="p-2 -ml-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowParticipantsDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors border border-white/10"
          >
            <div className="flex -space-x-1.5">
              {participants.slice(0, 3).map((p) => (
                <Avatar key={p.user_id} className="w-5 h-5 border border-white/20 bg-white/10 shrink-0">
                  <AvatarImage src={getDisplayAvatarUrl(p.avatar_url)} alt={p.name || ""} className="object-cover" />
                  <AvatarFallback className="bg-white/5">
                    <User className="w-2.5 h-2.5 text-white/40" />
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-white/70 font-medium">{displayAttendeeCount}</span>
          </button>
        </div>

        {/* Event identity: image / emoji + name + date */}
        <div className="flex items-center gap-4 px-4 pb-4 border-b border-white/8">
          {/* Event image or emoji */}
          <div className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center">
            {activity.image_url ? (
              <img src={activity.image_url} alt={label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl leading-none">{emoji}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white leading-tight truncate">{label}</h2>
            {activity.note && (
              <p className="text-xs text-white/50 truncate mt-0.5">{activity.note}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="text-xs text-primary/80 font-medium">{formattedDate}</span>
              <span className="text-xs text-white/40">·</span>
              <span className="text-xs text-white/50">{formattedTime}</span>
            </div>
            {creatorProfile?.name && (
              <p className="text-xs text-white/35 mt-0.5">by {creatorProfile.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3">
            <span className="text-4xl">{emoji}</span>
            <p className="text-center text-sm">
              Start planning!<br />
              <span className="text-xs text-white/30">Coordinate details with everyone joining.</span>
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            const profile = profiles[msg.user_id];
            const displayName = isOwn ? "You" : profile?.name || "Shaker";
            const avatarUrl = isOwn ? (ownProfile?.avatar_url ?? profile?.avatar_url) : profile?.avatar_url;
            const isGif =
              (msg.message_type ?? "text") === "gif" && /^https?:\/\//i.test(msg.message);
            const stickerMsg = !isGif && isSticker(msg.message);

            return (
              <div key={msg.id} className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                {!stickerMsg && (
                  <button
                    onClick={() => !isOwn && setSelectedUserProfile({ userId: msg.user_id, userName: profile?.name || null, avatarUrl: profile?.avatar_url || null })}
                    disabled={isOwn}
                    className="w-8 h-8 shrink-0"
                  >
                    <Avatar className="w-8 h-8 rounded-full border border-white/10 bg-white/5">
                      <AvatarImage src={getDisplayAvatarUrl(avatarUrl)} alt={displayName} className="object-cover" />
                      <AvatarFallback className="bg-white/5">
                        <User className="w-4 h-4 text-white/40" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                )}

                <div className={`flex-1 max-w-[75%] ${isGif ? "shrink-0 overflow-visible" : ""} ${isOwn ? "text-right" : ""} ${stickerMsg ? "max-w-full" : ""}`}>
                  {!stickerMsg && (
                    <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? "justify-end" : ""}`}>
                      <button
                        className={`font-semibold text-sm text-white ${!isOwn ? "hover:text-primary cursor-pointer" : ""}`}
                        onClick={() => !isOwn && setSelectedUserProfile({ userId: msg.user_id, userName: profile?.name || null, avatarUrl: profile?.avatar_url || null })}
                        disabled={isOwn}
                      >
                        {displayName}
                      </button>
                      <span className="text-xs text-white/30">{format(new Date(msg.created_at), "h:mm a")}</span>
                    </div>
                  )}

                  <div className={`flex items-center gap-1 ${isOwn ? "flex-row-reverse" : ""} ${stickerMsg ? "justify-center" : ""}`}>
                    {stickerMsg ? (
                      <div className={`flex flex-col items-center gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
                        <span className="text-5xl leading-none select-none" title={isOwn ? "You" : displayName}>
                          {msg.message.trim()}
                        </span>
                        <span className="text-xs text-white/25">{format(new Date(msg.created_at), "h:mm a")}</span>
                      </div>
                    ) : isGif ? (
                      <InlineChatGif
                        src={msg.message}
                        variant="dark"
                        onLoad={() =>
                          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                        }
                      />
                    ) : (
                      <div className={`text-sm px-3 py-2 rounded-2xl inline-block ${
                        isOwn
                          ? "bg-[#7c5cfc] text-white rounded-xl-sm"
                          : "bg-white/10 text-white border border-white/10 rounded-xl-sm"
                      }`}>
                        {msg.message}
                      </div>
                    )}
                    {isOwn && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-all shrink-0"
                        title="Delete"
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

      {/* ── STICKER PICKER ── */}
      {showStickerPicker && (
        <div className="relative z-10 shrink-0 bg-[#0d0d14] border-t border-white/8">
          {/* Pack tabs */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex gap-1">
              {STICKER_PACKS.map((pack, i) => (
                <button
                  key={pack.label}
                  onClick={() => setActiveStickerPack(i)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeStickerPack === i
                      ? "bg-[#7c5cfc] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowStickerPicker(false)} className="p-1 text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Sticker grid */}
          <div className="grid grid-cols-5 gap-1 px-3 pb-3">
            {STICKER_PACKS[activeStickerPack].stickers.map((sticker) => (
              <button
                key={sticker}
                onClick={() => handleSendSticker(sticker)}
                className="text-3xl h-12 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-90 transition-all"
              >
                {sticker}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── QUICK SUGGESTIONS ── */}
      {!showStickerPicker && user && !message.trim() && (
        <div className="relative z-10 px-4 pb-2 overflow-x-auto scrollbar-hide shrink-0">
          <div className="flex gap-1.5 w-max">
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-white/5 text-primary hover:bg-white/10 border border-white/10 whitespace-nowrap shrink-0 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <div className="relative z-10 p-3 border-t border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGiphyPickerOpen(false);
              setShowStickerPicker((v) => !v);
            }}
            className={`shrink-0 p-2 rounded-full transition-colors ${showStickerPicker ? "bg-[#7c5cfc] text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
            title="Stickers"
            disabled={!user || giphyPickerOpen}
          >
            <Smile className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowStickerPicker(false);
              setGiphyPickerOpen(true);
            }}
            className={`shrink-0 p-2 rounded-full transition-colors ${giphyPickerOpen ? "bg-[#7c5cfc] text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
            title="GIFs"
            aria-label="GIFs"
            disabled={!user || isSending}
          >
            <Images className="w-5 h-5" />
          </button>
          <Input
            ref={inputRef}
            placeholder={!user ? "Sign in to chat" : canSendText ? "Message..." : "Character limit reached"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!user || (!isPremium && !canSendText) || giphyPickerOpen}
            className="flex-1 bg-white/5 border-white/10 focus-visible:ring-[#7c5cfc]/50 text-white placeholder:text-white/35 min-h-9 rounded-full px-4"
            onFocus={() => setShowStickerPicker(false)}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={isSending || !message.trim() || !user || giphyPickerOpen}
            className="shrink-0 h-9 w-9 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0 rounded-full"
          >
            {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── DIALOGS ── */}
      {selectedUserProfile && (
        <UserProfileDialog
          open={!!selectedUserProfile}
          onOpenChange={() => setSelectedUserProfile(null)}
          userId={selectedUserProfile.userId}
          userName={selectedUserProfile.userName}
          avatarUrl={selectedUserProfile.avatarUrl}
        />
      )}
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

      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
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
