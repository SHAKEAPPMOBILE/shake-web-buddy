import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Users, Clock, Bell, BellOff, LogOut, Smile } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import {
  EVENT_CHAT_STICKER_IDS,
  EVENT_CHAT_STICKER_LABELS,
  isEventChatStickerId,
} from "@/lib/eventChatStickers";
import { EventStickerGraphic } from "@/components/eventChat/EventChatStickerSvgs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EventChatPageParams {
  eventId?: string;
}

/** One-shot confetti from the tap point when sending a sticker (viewport coords). */
function StickerSendConfetti({ x, y, seed }: { x: number; y: number; seed: number }) {
  const particles = useMemo(() => {
    const colors = ["#f472b6", "#a78bfa", "#38bdf8", "#fbbf24", "#34d399", "#fb7185"];
    return colors.map((color, i) => {
      const ang = (i / colors.length) * Math.PI * 2 + 0.4;
      const d = 46 + (i % 3) * 9;
      return {
        color,
        tx: Math.round(Math.cos(ang) * d),
        ty: Math.round(Math.sin(ang) * d),
        i,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden>
      <style>
        {particles.map(
          (p) => `
          @keyframes ec-send-${seed}-${p.i} {
            to { transform: translate(${p.tx}px, ${p.ty}px); opacity: 0; }
          }
        `
        ).join("")}
      </style>
      {particles.map((p) => (
        <span
          key={p.i}
          className="absolute w-2.5 h-2.5 rounded-full shadow-sm"
          style={{
            left: x - 5,
            top: y - 5,
            background: p.color,
            animation: `ec-send-${seed}-${p.i} 0.55s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function EventChatPage() {
  const { eventId } = useParams<EventChatPageParams>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventName, setEventName] = useState<string>("Event chat");
  const [eventStartsAt, setEventStartsAt] = useState<string>(new Date().toISOString());
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string>("");
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [hasFatalError, setHasFatalError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const stickerBarRef = useRef<HTMLDivElement | null>(null);
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [stickerConfetti, setStickerConfetti] = useState<{ seed: number; x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_RETRIES = 3;
    setHasFatalError(false);

    const loadMeta = async () => {
      if (cancelled) return;
      let willRetry = false;
      setIsLoadingMeta(true);
      try {
        // 1) First check if user is in event_chat_members for this event
        const { data: member, error: memberError } = await supabase
          .from("event_chat_members")
          .select("event_id, paid_at, expires_at")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (memberError) {
          console.log("[EventChatPage] Error checking event_chat_members", memberError);
        }

        const resolveMembershipExpiry = (m: { expires_at?: string | null; paid_at?: string | null } | null) => {
          if (!m) return null;
          if (m.expires_at) {
            const d = new Date(m.expires_at);
            if (!isNaN(d.getTime())) return d;
          }
          if (m.paid_at) {
            const d = new Date(m.paid_at);
            if (!isNaN(d.getTime())) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
          }
          return null;
        };

        if (!member) {
          // Wait 3 seconds before concluding user is not a member, to allow frontend upsert to complete
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const { data: recheckMember } = await supabase
            .from("event_chat_members")
            .select("event_id, paid_at, expires_at")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!recheckMember) {
            navigate("/events", { replace: true });
            return;
          }
          const recheckExpiry = resolveMembershipExpiry(recheckMember);
          if (recheckExpiry && recheckExpiry.getTime() <= Date.now()) {
            setIsLoadingMeta(false);
            return;
          }
        } else {
          const memberExpiry = resolveMembershipExpiry(member);
          if (memberExpiry && memberExpiry.getTime() <= Date.now()) {
            setIsLoadingMeta(false);
            return;
          }
        }

        // 2) User is a member — fetch event_chats
        const { data: chatRow, error: chatError } = await supabase
          .from("event_chats")
          .select("name, expires_at, created_at")
          .eq("event_id", eventId)
          .maybeSingle();

        if (cancelled) return;
        if (chatError) {
          console.log("[EventChatPage] Error loading event_chats", chatError);
        }

        if (chatRow) {
          setEventName(chatRow.name);
          const expires = new Date(chatRow.expires_at as string);
          if (!isNaN(expires.getTime())) {
            const start = new Date(expires.getTime() - 12 * 60 * 60 * 1000);
            setEventStartsAt(start.toISOString());
          }
          setIsLoadingMeta(false);
          return;
        }

        // 3) Member but event_chats row missing — create from public_events (expires_at = event_starts_at + 12h)
        const { data: pub } = await supabase
          .from("public_events")
          .select("name, event_starts_at, image_url")
          .eq("id", eventId)
          .maybeSingle();

        if (cancelled) return;

        let expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
        if (pub?.event_starts_at) {
          const start = new Date(pub.event_starts_at);
          if (!isNaN(start.getTime())) {
            expiresAt = new Date(start.getTime() + 12 * 60 * 60 * 1000);
            setEventDate(start.toLocaleDateString([], { month: "short", day: "numeric" }));
          }
        }
        if (pub?.image_url) setEventImageUrl(pub.image_url);
        if (pub?.name) setEventName(pub.name);

        await supabase.from("event_chats").upsert(
          {
            event_id: eventId,
            name: pub?.name ?? eventId,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: "event_id" }
        );

        if (cancelled) return;

        attempts += 1;
        if (attempts <= MAX_RETRIES) {
          willRetry = true;
          setTimeout(loadMeta, 2000);
          return;
        }
        setHasFatalError(true);
      } catch (e) {
        console.log("[EventChatPage] Unexpected error loading metadata", e);
        attempts += 1;
        if (attempts <= MAX_RETRIES) {
          willRetry = true;
          setTimeout(loadMeta, 2000);
          return;
        }
        setHasFatalError(true);
      } finally {
        if (!cancelled && !willRetry) {
          setIsLoadingMeta(false);
        }
      }
    };

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [eventId, user, navigate]);

  const {
    status,
    messages,
    senderMap,
    memberCount,
    minutesLeft,
    sendMessage,
    isSending,
  } = useEventChat({
    eventId: eventId ?? "",
    eventName,
    eventStartsAt,
  });

  const [inputValue, setInputValue] = useState("");

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!showStickerTray) return;
    const onDoc = (e: MouseEvent) => {
      if (stickerBarRef.current && !stickerBarRef.current.contains(e.target as Node)) {
        setShowStickerTray(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showStickerTray]);

  useEffect(() => {
    if (!stickerConfetti) return;
    const t = window.setTimeout(() => setStickerConfetti(null), 600);
    return () => clearTimeout(t);
  }, [stickerConfetti]);

  const headerSubtitle = useMemo(() => {
    if (minutesLeft !== null && status === "active") {
      return `Chat closes in ${minutesLeft}m`;
    }
    if (status === "expired") {
      return "This chat ended 12h after the event 🎤";
    }
    return "Messages from this event will appear here.";
  }, [minutesLeft, status]);

  if (!eventId) {
    return null;
  }

  return (
    <>
    {stickerConfetti ? (
      <StickerSendConfetti x={stickerConfetti.x} y={stickerConfetti.y} seed={stickerConfetti.seed} />
    ) : null}
    <div className="fixed inset-0 flex flex-col bg-[#06060a] z-40">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at 8% 0%, rgba(139,92,246,0.65) 0%, transparent 55%), radial-gradient(circle at 92% 18%, rgba(236,72,153,0.6) 0%, transparent 55%), radial-gradient(circle at 50% 100%, rgba(56,189,248,0.5) 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-white/5">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-1.5 text-white/80 hover:text-white"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {eventImageUrl && (
              <div
                className="shrink-0 flex flex-col items-center"
                style={{
                  background: "white",
                  padding: "3px 3px 8px 3px",
                  borderRadius: "2px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  transform: "rotate(-2deg)",
                  width: "46px",
                }}
              >
                <img
                  src={eventImageUrl}
                  alt={eventName}
                  style={{ width: "40px", height: "40px", objectFit: "cover", display: "block" }}
                />
                <span style={{ fontSize: "6px", color: "#555", marginTop: "2px", maxWidth: "40px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {eventDate}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-white truncate">{eventName}</h1>
              <p className="text-xs text-white/50 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{headerSubtitle}</span>
              </p>
            </div>
          </div>
          {memberCount !== null && (
            <div className="flex items-center gap-1 text-xs text-white/60">
              <Users className="w-3.5 h-3.5" />
              <span>{memberCount}</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 ml-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted((prev) => !prev)}
              className="shrink-0 text-white/60 hover:text-white hover:bg-white/5 h-8 w-8"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                if (!user) return;
                await supabase
                  .from("event_chat_members")
                  .delete()
                  .eq("event_id", eventId)
                  .eq("user_id", user.id);
                navigate(-1);
              }}
              className="shrink-0 text-white/50 hover:text-red-400 hover:bg-white/5 h-8 w-8"
              title="Leave chat"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingMeta && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!isLoadingMeta && !hasFatalError && messages.length === 0 && status !== "error" && status !== "locked" && (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <p className="text-center text-sm">
                Start the conversation!<br />
                <span className="text-xs">Messages from today will appear here.</span>
              </p>
            </div>
          )}

          {messages.map((m) => {
            const profile = senderMap[m.user_id];
            const displayName = profile?.name || "User";
            const avatarUrl = profile?.avatar_url;
            const isOwn = user?.id === m.user_id;
            const isSticker = m.message_type === "sticker";
            const stickerId = isSticker && isEventChatStickerId(m.content) ? m.content : null;

            return (
              <div key={m.id} className={`group flex gap-3 items-end ${isOwn ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/5">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-white/5 flex items-center justify-center">
                    <span className="text-xs text-white/40">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`min-w-0 w-fit max-w-[70%] ${isOwn ? "text-right" : "text-left"}`}
                >
                  <div className={`flex items-baseline gap-2 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
                    <span className="font-semibold text-sm text-white">
                      {isOwn ? "You" : displayName}
                    </span>
                    <span className="text-xs text-white/35">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className={`mt-0.5 ${isOwn ? "flex justify-end" : "flex justify-start"}`}>
                    {isSticker && stickerId ? (
                      <div
                        className="inline-flex items-center justify-center select-none"
                        style={{ width: 120, height: 120 }}
                        role="img"
                        aria-label={EVENT_CHAT_STICKER_LABELS[stickerId]}
                      >
                        <EventStickerGraphic stickerId={stickerId} size={120} className="drop-shadow-md" />
                      </div>
                    ) : isSticker ? (
                      <span className="mt-1 text-2xl opacity-70" aria-label="Sticker">
                        {m.content}
                      </span>
                    ) : (
                      <div
                        className={`text-sm px-3 py-2 rounded-xl inline-block text-left ${
                          isOwn ? "bg-[#7c5cfc] text-white" : "bg-white/10 text-white border border-white/10"
                        }`}
                      >
                        <span>{m.content}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {status === "locked" && (
            <p className="text-xs text-white/50 text-center mt-4">
              You don&apos;t have access to this chat yet. If you just paid, please wait a moment for the
              payment to be processed.
            </p>
          )}

          {hasFatalError && (
            <p className="text-xs text-red-400 text-center mt-4">
              Something went wrong loading this chat. Please try again later.
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          ref={stickerBarRef}
          className="relative p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/5"
        >
          {showStickerTray && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 mx-1 rounded-2xl border border-white/10 bg-[#12121a]/95 backdrop-blur-md shadow-lg p-3 z-20"
              role="dialog"
              aria-label="Sticker picker"
            >
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 px-0.5">Event stickers</p>
              <div className="grid grid-cols-4 gap-2">
                {EVENT_CHAT_STICKER_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 shadow-inner hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40"
                    disabled={isSending || status !== "active"}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setStickerConfetti((prev) => ({
                        seed: (prev?.seed ?? 0) + 1,
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                      }));
                      void sendMessage(id, "sticker");
                      setShowStickerTray(false);
                    }}
                    aria-label={`Send ${EVENT_CHAT_STICKER_LABELS[id]} sticker`}
                  >
                    <EventStickerGraphic stickerId={id} size={68} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setShowStickerTray((v) => !v)}
              disabled={isSending || status !== "active"}
              aria-label="Stickers"
              aria-expanded={showStickerTray}
              aria-haspopup="dialog"
            >
              <Smile className="w-5 h-5" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!inputValue.trim()) return;
                  void sendMessage(inputValue);
                  setInputValue("");
                }
              }}
              className="flex-1 bg-white/5 border-white/10 focus-visible:ring-[#7c5cfc]/50 text-white placeholder:text-white/40 min-h-9"
              disabled={isSending || status !== "active"}
            />
            <Button
              size="icon"
              onClick={async () => {
                if (!inputValue.trim()) return;
                await sendMessage(inputValue);
                setInputValue("");
              }}
              disabled={isSending || !inputValue.trim()}
              className="shrink-0 h-9 w-9 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
            >
              {isSending ? <LoadingSpinner size="sm" /> : <span className="text-xs font-semibold">➤</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

