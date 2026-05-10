import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Trash2, Images, MoreVertical, LogOut } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useMessageReactionsForTable } from "@/hooks/useMessageReactionsForTable";
import { useMessageReactionBarState } from "@/hooks/useMessageReactionBarState";
import { MessageBubbleReactions } from "@/components/chat/MessageBubbleReactions";
import { aggregateReactionsByMessage, sortedReactionEntries } from "@/lib/eventChatReactions";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { playNotificationSound } from "@/lib/notification-sound";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useActivityVenue } from "@/contexts/VenueContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTextMessageLimit } from "@/hooks/useTextMessageLimit";
import { PremiumDialog } from "@/components/PremiumDialog";
import { LoadingSpinner } from "../LoadingSpinner";
import { getActivityEmoji } from "@/data/activityTypes";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { InlineChatGif } from "@/components/chat/InlineChatGif";
import { getNationalityFlag } from "@/data/countryCodes";

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
}

interface PlanGroupChatViewProps {
  activity: Activity;
  onBack: () => void;
  attendeeCount?: number;
}

// Curtain snap positions — three states
type SnapState = 'collapsed' | 'partial' | 'full';
const SNAP_HEIGHTS: Record<SnapState, number> = { collapsed: 88, partial: 320, full: 460 };
const SNAP_THRESHOLD = 60;

// Frosted glass pill style shared by avatar + occupation pills
const pillStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.3)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 999,
};

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
  const [participants, setParticipants] = useState<{
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    nationality: string | null;
    occupation: string | null;
  }[]>([]);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Curtain drag state
  const [snapState, setSnapState] = useState<SnapState>('partial');
  const [isDragging, setIsDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const isDraggingHeader = useRef(false);
  const dragStartY = useRef(0);
  const dragDeltaRef = useRef(0);

  const { canSendText, addCharacters } = useTextMessageLimit();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isPremium } = useAuth();

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactionsEnabled = Boolean(user && activity.id);
  const { rows: reactionRows, toggleReaction } = useMessageReactionsForTable({
    table: "plan_message_reactions",
    realtimeChannelId: `plan-msg-reactions:${activity.id}`,
    messageIds,
    userId: user?.id,
    enabled: reactionsEnabled,
  });
  const reactionsByMessage = useMemo(
    () => aggregateReactionsByMessage(reactionRows, user?.id),
    [reactionRows, user?.id]
  );
  const { reactionBarMessageId, mobileReactionBarRef, onMessagePointerDown, onMessagePointerEnd } =
    useMessageReactionBarState(reactionsEnabled);
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
    if (!ids.includes(activity.user_id)) ids.push(activity.user_id);
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

      if (error) { console.error("Error fetching plan messages:", error); return; }
      setMessages(data || []);

      if (user?.id) {
        await supabase.from("activity_read_status").upsert({
          user_id: user.id,
          activity_type: activity.id,
          city: "plan",
          last_read_at: new Date().toISOString(),
        }, { onConflict: "user_id,activity_type,city" });
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`plan-messages-${activity.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "plan_messages",
        filter: `activity_id=eq.${activity.id}`,
      }, (payload) => {
        const newMessage = payload.new as PlanMessage;
        setMessages((prev) => [...prev, newMessage]);
        if (newMessage.user_id !== user?.id) playNotificationSound();
        if (user?.id) {
          supabase.from("activity_read_status").upsert({
            user_id: user.id, activity_type: activity.id, city: "plan",
            last_read_at: new Date().toISOString(),
          }, { onConflict: "user_id,activity_type,city" });
        }
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "plan_messages",
      }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activity.id, user?.id]);

  // Fetch participants with nationality + occupation
  useEffect(() => {
    if (!activity.id) return;

    const fetchParticipants = async () => {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, nationality, occupation")
        .eq("user_id", activity.user_id)
        .maybeSingle();

      const { data: joins } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id);

      const joinedIds = (joins || []).map((j) => j.user_id).filter((id) => id !== activity.user_id);
      let joinedProfiles: typeof participants = [];

      if (joinedIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url, nationality, occupation")
          .in("user_id", joinedIds);
        joinedProfiles = (profilesData || []).map((p) => ({
          user_id: p.user_id,
          name: p.name ?? null,
          avatar_url: p.avatar_url ?? null,
          nationality: p.nationality ?? null,
          occupation: p.occupation ?? null,
        }));
      }

      const all: typeof participants = [];
      if (ownerProfile) {
        all.push({
          user_id: ownerProfile.user_id,
          name: ownerProfile.name ?? null,
          avatar_url: ownerProfile.avatar_url ?? null,
          nationality: ownerProfile.nationality ?? null,
          occupation: ownerProfile.occupation ?? null,
        });
      }
      all.push(...joinedProfiles);
      setParticipants(all);
    };

    fetchParticipants();
  }, [activity.id, activity.user_id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Curtain drag handlers ──────────────────────────────────────────────────

  const resolveSnap = (prev: SnapState, delta: number): SnapState => {
    if (delta < -SNAP_THRESHOLD) {
      if (prev === 'full') return 'partial';
      if (prev === 'partial') return 'collapsed';
    }
    if (delta > SNAP_THRESHOLD) {
      if (prev === 'collapsed') return 'partial';
      if (prev === 'partial') return 'full';
    }
    return prev;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingHeader.current = true;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragDeltaRef.current = 0;
    setDragDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingHeader.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragDeltaRef.current = delta;
    setDragDelta(delta);
  };

  const handleTouchEnd = () => {
    if (!isDraggingHeader.current) return;
    isDraggingHeader.current = false;
    setIsDragging(false);
    const delta = dragDeltaRef.current;
    setSnapState(prev => resolveSnap(prev, delta));
    setDragDelta(0);
    dragDeltaRef.current = 0;
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHeader.current = true;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragDeltaRef.current = 0;
    setDragDelta(0);

    const onMouseMove = (me: MouseEvent) => {
      if (!isDraggingHeader.current) return;
      const delta = me.clientY - dragStartY.current;
      dragDeltaRef.current = delta;
      setDragDelta(delta);
    };

    const onMouseUp = () => {
      isDraggingHeader.current = false;
      setIsDragging(false);
      const delta = dragDeltaRef.current;
      setSnapState(prev => resolveSnap(prev, delta));
      setDragDelta(0);
      dragDeltaRef.current = 0;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ── Plan action handlers ───────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!message.trim() || !user || isSending) return;

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
    if (error) toast.error("Failed to delete message");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleGifSelect = async (url: string) => {
    if (!user || isSending) return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return;

    if (!isPremium && !canSendText) {
      setShowPremiumDialog(true);
      toast.error("You've reached the 100K character limit. Upgrade to Super-Human for unlimited messaging!");
      throw new Error("Character limit reached");
    }

    setIsSending(true);
    try {
      const { error } = await supabase.from("plan_messages").insert({
        activity_id: activity.id, user_id: user.id, message: trimmed, message_type: "gif",
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error sending GIF:", error);
      toast.error("Failed to send GIF");
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const isCreator = user?.id === activity.user_id;

  const handleLeavePlan = async () => {
    setShowMenu(false);
    const { error } = await supabase.from("activity_joins").delete()
      .eq("user_id", user!.id).eq("activity_id", activity.id);
    if (error) { toast.error("Failed to leave plan"); }
    else { toast.success("Left the plan"); onBack(); }
  };

  const handleDeletePlan = async () => {
    setShowMenu(false);
    const { error } = await supabase.from("user_activities").delete()
      .eq("id", activity.id).eq("user_id", user!.id);
    if (error) { toast.error("Failed to delete plan"); }
    else { toast.success("Plan deleted"); onBack(); }
  };

  const creatorProfile = profiles[activity.user_id];

  const planDateLabel = (() => {
    const d = activity.scheduled_for ? new Date(activity.scheduled_for) : null;
    if (!d || isNaN(d.getTime())) return null;
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  const planEmoji = getActivityEmoji(activity.activity_type);
  const planTitle = activity.note || t('plans.untitledPlan', 'Untitled Plan');

  // Curtain live height
  const baseHeight = SNAP_HEIGHTS[snapState];
  const liveHeaderHeight = isDragging
    ? Math.max(SNAP_HEIGHTS.collapsed, Math.min(SNAP_HEIGHTS.full, baseHeight + dragDelta))
    : baseHeight;

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(50,40%,92%)] z-50 pt-[env(safe-area-inset-top)]">

      {/* ── COLLAPSIBLE HEADER CURTAIN ────────────────────────────────────── */}
      <div
        className="relative z-30 shrink-0 overflow-hidden"
        style={{
          height: liveHeaderHeight,
          transition: isDragging ? 'none' : 'height 0.3s ease',
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 70%, #f5576c 100%)",
        }}
      >
        {/* Full expanded content — fades out when collapsed */}
        <div
          style={{
            opacity: snapState === 'collapsed' ? 0 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: snapState === 'collapsed' ? 'none' : 'auto',
          }}
        >
          {/* Back + menu — absolutely pinned so they don't participate in flow */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 z-10">
            <MinimalBackButton
              onClick={onBack}
              className="shrink-0 text-white/80 hover:text-white"
              aria-label="Back"
              iconClassName="w-6 h-6"
            />
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-white/80" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-black/10 z-50 overflow-hidden">
                    {isCreator ? (
                      <button onClick={handleDeletePlan} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" /> Delete plan
                      </button>
                    ) : (
                      <button onClick={handleLeavePlan} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" /> Leave plan
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Content column — normal flow, top to bottom, no overlap */}
          <div className="flex flex-col items-center px-4 pb-4" style={{ paddingTop: 64 }}>
            {/* 1. Creator avatar / emoji */}
            <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 overflow-hidden flex items-center justify-center shadow-sm">
              {creatorProfile?.avatar_url ? (
                <Avatar className="w-full h-full rounded-full">
                  <AvatarImage src={getDisplayAvatarUrl(creatorProfile.avatar_url)} alt={creatorProfile?.name || "Creator"} className="object-cover" />
                  <AvatarFallback className="bg-white/20 flex items-center justify-center">
                    <span className="text-4xl">{planEmoji}</span>
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-4xl">{planEmoji}</span>
              )}
            </div>

            {/* 2. Plan title */}
            <h1 className="text-base font-bold text-white text-center leading-tight mt-2">{planTitle}</h1>

            {/* 3. Date label */}
            {planDateLabel && <p className="text-sm font-semibold text-white/90 mt-1">{planDateLabel}</p>}

            {/* 4. Avatar pill */}
            <div className="flex justify-center w-full mt-4">
              {participants.length === 0 ? (
                <div style={{ ...pillStyle, padding: '10px 20px' }}>
                  <p className="text-xs text-white/70">You're the first one here!</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowParticipantsDialog(true)}
                  className="flex items-center gap-2"
                  style={{ ...pillStyle, padding: '10px 20px' }}
                >
                  {participants.map((p) => (
                    <Avatar key={p.user_id} className="w-8 h-8 rounded-full border border-white/30 bg-white/20 shrink-0">
                      <AvatarImage src={getDisplayAvatarUrl(p.avatar_url)} alt={p.name || "User"} className="object-cover" />
                      <AvatarFallback className="bg-white/20 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-white/70" />
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </button>
              )}
            </div>

            {/* 5. Occupation pill — clipped by overflow:hidden in PARTIAL, visible in FULL */}
            {participants.some(p => p.occupation || p.nationality) && (
              <div className="flex justify-center w-full mt-3">
                <div
                  className="flex flex-col gap-1"
                  style={{ ...pillStyle, padding: '10px 20px' }}
                >
                  {participants
                    .filter(p => p.occupation || p.nationality)
                    .map((p) => (
                      <p key={p.user_id} className="text-xs text-white/90 leading-snug text-center whitespace-nowrap">
                        {p.name || 'Shaker'}
                        {p.nationality ? ` ${getNationalityFlag(p.nationality)}` : ''}
                        {p.occupation ? ` · ${p.occupation}` : ''}
                      </p>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsed thin bar — shown when header is collapsed */}
        <div
          className="absolute inset-0 flex items-center justify-between px-4"
          style={{
            opacity: snapState === 'collapsed' ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: snapState === 'collapsed' ? 'auto' : 'none',
          }}
        >
          <MinimalBackButton
            onClick={onBack}
            className="shrink-0 text-white/80 hover:text-white"
            aria-label="Back"
            iconClassName="w-5 h-5"
          />
          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
            <span className="text-base">{planEmoji}</span>
            {planTitle}
          </span>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-white/80" />
          </button>
        </div>
      </div>

      {/* ── DRAG HANDLE PILL ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center bg-[hsl(50,40%,92%)] shrink-0 select-none"
        style={{ height: 28, cursor: isDragging ? 'grabbing' : 'grab' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="h-1 w-10 rounded-full bg-gray-400/50" />
      </div>

      {/* ── CHAT MESSAGES ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-2 space-y-4">
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
            const msgReactions = reactionsByMessage[msg.id];
            const reactionChips = msgReactions ? sortedReactionEntries(msgReactions) : [];
            const isGif = (msg.message_type ?? "text") === "gif" && /^https?:\/\//i.test(msg.message);

            return (
              <div key={msg.id} className={`group flex items-end gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isOwnMessage) {
                      setSelectedUserProfile({ userId: msg.user_id, userName: profile?.name || null, avatarUrl: profile?.avatar_url || null });
                    }
                  }}
                  className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-border"
                  disabled={isOwnMessage}
                >
                  <Avatar className="w-full h-full rounded-full bg-muted">
                    <AvatarImage src={getDisplayAvatarUrl(avatarUrl)} alt={displayName} className="object-cover" />
                    <AvatarFallback className="bg-muted flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className={`min-w-0 max-w-[70%] ${isGif ? "shrink-0 overflow-visible" : ""} ${isOwnMessage ? "text-right" : "text-left"}`}>
                  <MessageBubbleReactions
                    variant="light"
                    isOwn={isOwnMessage}
                    messageId={msg.id}
                    enabled={reactionsEnabled}
                    reactionBarMessageId={reactionBarMessageId}
                    mobileReactionBarRef={mobileReactionBarRef}
                    reactionChips={reactionChips}
                    onToggleReaction={toggleReaction}
                    onPointerDown={onMessagePointerDown(msg.id)}
                    onPointerUp={onMessagePointerEnd}
                    onPointerCancel={onMessagePointerEnd}
                    onPointerLeave={onMessagePointerEnd}
                    header={
                      <div className={`flex items-baseline gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <button
                          type="button"
                          className={`font-semibold text-sm text-black ${!isOwnMessage ? "hover:underline cursor-pointer" : ""}`}
                          onClick={() => {
                            if (!isOwnMessage) {
                              setSelectedUserProfile({ userId: msg.user_id, userName: profile?.name || null, avatarUrl: profile?.avatar_url || null });
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
                    }
                  >
                    <div className={`flex items-center gap-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                      {isGif ? (
                        <InlineChatGif
                          src={msg.message}
                          variant="light"
                          onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                        />
                      ) : (
                        <div
                          className="text-sm px-3 py-2 inline-block"
                          style={isOwnMessage ? {
                            background: "rgba(139, 92, 246, 0.55)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            borderRadius: "18px 18px 4px 18px",
                            color: "white",
                          } : {
                            background: "rgba(0,0,0,0.06)",
                            border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: "18px 18px 18px 4px",
                            color: "#111",
                          }}
                        >
                          <span>{msg.message}</span>
                        </div>
                      )}
                      {isOwnMessage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </MessageBubbleReactions>
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 text-black/60 hover:text-black hover:bg-black/5"
            onClick={() => setGiphyPickerOpen(true)}
            disabled={!user || isSending || giphyPickerOpen}
            aria-label="GIFs"
            title="GIFs"
          >
            <Images className="w-5 h-5" />
          </Button>
          <Input
            placeholder={user ? (canSendText ? t('chat.typeMessage', 'Type a message...') : t('chat.characterLimitReached', 'Character limit reached')) : t('chat.signInToChat', 'Sign in to chat')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!user || (!isPremium && !canSendText) || giphyPickerOpen}
            className="flex-1 bg-blue-500/10 border-blue-500/30 focus-visible:ring-blue-500/50 text-black placeholder:text-black/50"
          />
          <Button onClick={handleSendMessage} disabled={!message.trim() || isSending || !user || giphyPickerOpen} variant="shake">
            {isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {user ? (
        <EventChatGiphyPickerModal
          open={giphyPickerOpen}
          onOpenChange={setGiphyPickerOpen}
          onGifSelect={handleGifSelect}
        />
      ) : null}

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
    </div>
  );
}
