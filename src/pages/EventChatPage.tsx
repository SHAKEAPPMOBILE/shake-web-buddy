import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  type ChangeEvent,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Users, Clock, Bell, BellOff, LogOut, Smile, Camera, X } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import {
  EVENT_CHAT_STICKER_IDS,
  EVENT_CHAT_STICKER_LABELS,
  isEventChatStickerId,
} from "@/lib/eventChatStickers";
import { EventStickerGraphic } from "@/components/eventChat/EventChatStickerSvgs";
import { supabase } from "@/integrations/supabase/client";
import type { EventChatLocationState } from "@/lib/eventChatNavigation";
import { isEventChatMembershipExplicitlyExpired } from "@/lib/eventChatMembership";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatStatus } from "@/hooks/useEventChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  EVENT_CHAT_VIDEO_MAX_SECONDS,
  formatVideoDuration,
  getVideoDurationSeconds,
  uploadEventChatVideoWithProgress,
} from "@/lib/eventChatVideoUpload";

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
  const location = useLocation();
  const chatNavState = location.state as EventChatLocationState | null;
  const prefetch = chatNavState?.eventPrefetch;

  const navigateBackFromEventChat = useCallback(() => {
    const mode = (location.state as EventChatLocationState | null)?.eventsReturn?.mode;
    if (mode === "home_near_you") {
      console.log("[EventChatPage] navigate → / with openEvents (restore embedded Near You)");
      navigate("/", { replace: true, state: { openEvents: true } });
      return;
    }
    if (mode === "standalone_events") {
      console.log("[EventChatPage] navigate → /events replace (refetch Near You list)");
      navigate("/events", { replace: true });
      return;
    }
    console.log("[EventChatPage] navigate back (-1) (no eventsReturn in state)");
    navigate(-1);
  }, [navigate, location.state]);
  const prefetchStart =
    prefetch?.eventStartsAt && !Number.isNaN(new Date(prefetch.eventStartsAt).getTime())
      ? prefetch.eventStartsAt
      : null;
  const { user, isLoading: authLoading } = useAuth();
  const [eventName, setEventName] = useState<string>(() => prefetch?.name?.trim() || "Event chat");
  const [eventStartsAt, setEventStartsAt] = useState<string>(
    () => prefetchStart ?? new Date().toISOString()
  );
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(() => prefetch?.imageUrl ?? null);
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
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [videoDraft, setVideoDraft] = useState<{
    file: File;
    previewUrl: string;
    durationSec: number;
  } | null>(null);
  const [videoClipError, setVideoClipError] = useState<string | null>(null);
  const [videoUploadRatio, setVideoUploadRatio] = useState(0);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [chatDataLoadEnabled, setChatDataLoadEnabled] = useState(false);
  useEffect(() => {
    setChatDataLoadEnabled(false);
  }, [eventId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      console.log("[EventChatPage] navigate → /auth (no user, auth finished loading)");
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!prefetchStart) return;
    const d = new Date(prefetchStart);
    if (Number.isNaN(d.getTime())) return;
    setEventDate(d.toLocaleDateString([], { month: "short", day: "numeric" }));
  }, [prefetchStart]);

  /** Full-screen route sits outside IOSAppLayout; in light theme `body` is near-white and shows through safe-area / overscroll. */
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.backgroundColor = "#06060a";
    body.style.backgroundColor = "#06060a";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  const chatStatusRef = useRef<ChatStatus>("loading");

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
    loadEnabled: chatDataLoadEnabled,
  });

  useEffect(() => {
    chatStatusRef.current = "loading";
  }, [eventId]);

  useEffect(() => {
    chatStatusRef.current = status;
  }, [status]);

  /** Strict Mode: closure `cancelled` was unreliable; generation + ref invalidates stale async work. */
  const metaGenRef = useRef(0);
  const lastInteractionRef = useRef(Date.now());
  const noMemberExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNoMemberExitTimer = useCallback(() => {
    if (noMemberExitTimerRef.current) {
      clearTimeout(noMemberExitTimerRef.current);
      noMemberExitTimerRef.current = null;
    }
  }, []);

  const bumpInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    clearNoMemberExitTimer();
  }, [clearNoMemberExitTimer]);

  useEffect(() => {
    if (!eventId || !user) return;

    const myGen = ++metaGenRef.current;
    const stale = () => myGen !== metaGenRef.current;

    let attempts = 0;
    const MAX_RETRIES = 3;
    setHasFatalError(false);

    const scheduleNoMemberNavigateWhenIdle = () => {
      clearNoMemberExitTimer();
      const step = () => {
        if (stale()) return;
        if (chatStatusRef.current === "active") {
          console.log("[EventChatPage] skip no-member navigate — chat became active", { eventId });
          return;
        }
        const idleMs = Date.now() - lastInteractionRef.current;
        const idleNeedMs = 30_000;
        if (idleMs < idleNeedMs) {
          noMemberExitTimerRef.current = setTimeout(step, idleNeedMs - idleMs + 50);
          return;
        }
        if (stale()) return;
        if (chatStatusRef.current === "active") return;
        try {
          sessionStorage.setItem("eventsEntrySource", "home");
        } catch {
          /* ignore */
        }
        console.log("[EventChatPage] navigate → /events (confirmed no member row + 30s idle + chat not active)", {
          eventId,
        });
        navigate("/events", { replace: true });
      };
      noMemberExitTimerRef.current = setTimeout(step, 0);
    };

    const loadMeta = async () => {
      if (stale()) return;
      let willRetry = false;
      setIsLoadingMeta(true);
      try {
        /** Post-payment race: membership row may not be visible on first read. */
        const MEMBERSHIP_POLL_ATTEMPTS = 5;
        const MEMBERSHIP_POLL_MS = 1000;
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

        let member: {
          event_id: string;
          paid_at?: string | null;
          expires_at?: string | null;
          event_name?: string | null;
          event_starts_at?: string | null;
        } | null = null;
        let hadSuccessfulMembershipRead = false;

        for (let attempt = 0; attempt < MEMBERSHIP_POLL_ATTEMPTS; attempt++) {
          if (stale()) return;
          const { data: row, error: memberError } = await supabase
            .from("event_chat_members")
            .select("event_id, paid_at, expires_at, event_name, event_starts_at")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (stale()) return;
          if (!memberError) hadSuccessfulMembershipRead = true;
          if (memberError) {
            console.log("[EventChatPage] Error checking event_chat_members", attempt + 1, memberError);
            if (attempt < MEMBERSHIP_POLL_ATTEMPTS - 1) await sleep(MEMBERSHIP_POLL_MS);
            continue;
          }
          if (row) {
            member = row;
            break;
          }
          if (attempt < MEMBERSHIP_POLL_ATTEMPTS - 1) await sleep(MEMBERSHIP_POLL_MS);
        }

        if (!member) {
          if (stale()) {
            console.log("[EventChatPage] skip post-poll work (stale gen, no member yet)", { eventId });
            return;
          }
          if (chatStatusRef.current === "active") {
            console.log("[EventChatPage] skip late check — chat already active after poll miss (race)", {
              eventId,
            });
            return;
          }
          const { data: lateMember, error: lateErr } = await supabase
            .from("event_chat_members")
            .select("event_id, paid_at, expires_at, event_name, event_starts_at")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!lateErr) hadSuccessfulMembershipRead = true;
          if (lateMember) member = lateMember;
        }

        if (!member) {
          if (stale()) return;
          if (chatStatusRef.current === "active") {
            console.log("[EventChatPage] skip navigate — chat active, no row on final check", {
              eventId,
            });
            return;
          }
          if (!hadSuccessfulMembershipRead) {
            console.log("[EventChatPage] skip navigate — membership queries never succeeded (network/RLS errors)", {
              eventId,
            });
            setHasFatalError(true);
            return;
          }
          setChatDataLoadEnabled(true);
          scheduleNoMemberNavigateWhenIdle();
          console.log("[EventChatPage] scheduled /events after idle — confirmed null member row from successful reads", {
            eventId,
          });
          return;
        }

        clearNoMemberExitTimer();

        if (isEventChatMembershipExplicitlyExpired(member)) {
          console.log("[EventChatPage] membership expires_at in past — enable chat UI for expired state", {
            eventId,
            expires_at: member.expires_at,
          });
          setChatDataLoadEnabled(true);
          return;
        }

        if (typeof member.event_starts_at === "string" && member.event_starts_at.trim()) {
          const es = new Date(member.event_starts_at);
          if (!Number.isNaN(es.getTime())) {
            setEventStartsAt(member.event_starts_at);
            setEventDate(es.toLocaleDateString([], { month: "short", day: "numeric" }));
          }
        }
        if (typeof member.event_name === "string" && member.event_name.trim()) {
          setEventName(member.event_name.trim());
        }

        console.log("[EventChatPage] setChatDataLoadEnabled(true) after membership row (event_starts_at/name from DB)", {
          eventId,
          event_starts_at: member.event_starts_at,
        });
        setChatDataLoadEnabled(true);

        const { data: chatRow, error: chatError } = await supabase
          .from("event_chats")
          .select("name, expires_at, created_at")
          .eq("event_id", eventId)
          .maybeSingle();

        console.log("[EventChatPage][event_chats lookup]", {
          eventId,
          found: !!chatRow,
          name: chatRow?.name ?? null,
          error: chatError?.message ?? null,
        });

        if (stale()) return;
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
          return;
        }

        const { data: pub } = await supabase
          .from("public_events")
          .select("name, event_starts_at, image_url")
          .eq("id", eventId)
          .maybeSingle();

        if (stale()) return;

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

        if (stale()) return;

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
        if (!stale() && !willRetry) {
          setIsLoadingMeta(false);
        }
      }
    };

    void loadMeta();

    return () => {
      clearNoMemberExitTimer();
      metaGenRef.current += 1;
      console.log("[EventChatPage] loadMeta effect cleanup (invalidate gen)", { eventId });
    };
  }, [eventId, user?.id, navigate, clearNoMemberExitTimer]);

  const [inputValue, setInputValue] = useState("");

  const clearVideoDraft = useCallback(() => {
    setVideoDraft((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setVideoClipError(null);
    setVideoUploadRatio(0);
    setIsVideoUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }, []);

  const draftPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    draftPreviewUrlRef.current = videoDraft?.previewUrl ?? null;
  }, [videoDraft?.previewUrl]);

  useEffect(() => {
    return () => {
      if (draftPreviewUrlRef.current) URL.revokeObjectURL(draftPreviewUrlRef.current);
    };
  }, []);

  const onVideoFilePicked = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = "";
      setVideoClipError(null);
      if (!file) return;
      try {
        const duration = await getVideoDurationSeconds(file);
        if (duration > EVENT_CHAT_VIDEO_MAX_SECONDS + 0.25) {
          setVideoClipError("Videos must be 60 seconds or less");
          return;
        }
        setVideoDraft((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return {
            file,
            previewUrl: URL.createObjectURL(file),
            durationSec: duration,
          };
        });
      } catch {
        setVideoClipError("Could not read this video. Try another file.");
      }
    },
    []
  );

  const handleSendVideoClip = useCallback(async () => {
    if (!videoDraft || !eventId || !user) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    bumpInteraction();
    setIsVideoUploading(true);
    setVideoUploadRatio(0);
    setVideoClipError(null);
    try {
      const publicUrl = await uploadEventChatVideoWithProgress(
        videoDraft.file,
        user.id,
        eventId,
        session.access_token,
        (r) => setVideoUploadRatio(r)
      );
      await sendMessage(publicUrl, "video");
      clearVideoDraft();
      setShowStickerTray(false);
    } catch (err) {
      console.error("[EventChatPage] video upload/send failed", err);
      setVideoClipError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsVideoUploading(false);
      setVideoUploadRatio(0);
    }
  }, [videoDraft, eventId, user, sendMessage, clearVideoDraft, bumpInteraction]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!showStickerTray) return;
    const onDoc = (e: PointerEvent) => {
      if (stickerBarRef.current && !stickerBarRef.current.contains(e.target as Node)) {
        setShowStickerTray(false);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [showStickerTray]);

  useEffect(() => {
    if (!stickerConfetti) return;
    const t = window.setTimeout(() => setStickerConfetti(null), 600);
    return () => clearTimeout(t);
  }, [stickerConfetti]);

  const headerSubtitle = useMemo(() => {
    if (isLoadingMeta || !chatDataLoadEnabled) return "Loading…";
    if (status === "locked") {
      return "Complete payment to join this chat.";
    }
    if (status === "expired") {
      return "This chat ended 12h after the event 🎤";
    }
    if (status === "error") {
      return "Something went wrong. Try again.";
    }
    if (minutesLeft !== null && (status === "active" || status === "loading")) {
      return `Chat closes in ${minutesLeft}m`;
    }
    if (status === "loading") {
      return "Loading messages…";
    }
    return "Messages from this event will appear here.";
  }, [isLoadingMeta, chatDataLoadEnabled, minutesLeft, status]);

  if (!eventId) {
    return null;
  }

  return (
    <>
    {stickerConfetti ? (
      <StickerSendConfetti x={stickerConfetti.x} y={stickerConfetti.y} seed={stickerConfetti.seed} />
    ) : null}
    <div className="fixed inset-0 z-40 flex min-h-[100dvh] flex-col bg-[#06060a]">
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
            type="button"
            onClick={() => {
              console.log("[EventChatPage] header back");
              navigateBackFromEventChat();
            }}
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
                console.log("[EventChatPage] leave chat → navigate away");
                navigateBackFromEventChat();
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

          {!isLoadingMeta &&
            chatDataLoadEnabled &&
            !hasFatalError &&
            messages.length === 0 &&
            status === "active" && (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <p className="text-center text-sm">
                Start the conversation!<br />
                <span className="text-xs">Messages from this event will appear here.</span>
              </p>
            </div>
          )}

          {!isLoadingMeta &&
            messages.map((m) => {
            const profile = senderMap[m.user_id];
            const displayName = profile?.name || "User";
            const avatarUrl = profile?.avatar_url;
            const isOwn = user?.id === m.user_id;
            const isSticker = m.message_type === "sticker";
            const isVideo = m.message_type === "video" && /^https?:\/\//i.test(m.content);
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
                    {isVideo ? (
                      <video
                        src={m.content}
                        controls
                        playsInline
                        preload="metadata"
                        className="rounded-lg max-w-[260px] w-full bg-black/30"
                      />
                    ) : isSticker && stickerId ? (
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

          {chatDataLoadEnabled && status === "locked" && (
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
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={onVideoFilePicked}
            aria-hidden
            tabIndex={-1}
          />

          {videoClipError && !videoDraft ? (
            <p className="text-xs text-red-400 mb-2 px-0.5" role="alert">
              {videoClipError}
            </p>
          ) : null}

          {videoDraft ? (
            <div className="mb-2 rounded-xl border border-white/15 bg-white/5 p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <video
                  src={videoDraft.previewUrl}
                  className="w-14 h-14 rounded-md object-cover bg-black shrink-0"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/90">{formatVideoDuration(videoDraft.durationSec)}</p>
                  {isVideoUploading ? (
                    <Progress
                      value={Math.min(100, Math.max(0, Math.round(videoUploadRatio * 100)))}
                      className="h-2 mt-2 bg-white/10 [&>div]:bg-[#7c5cfc]"
                    />
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearVideoDraft}
                  disabled={isVideoUploading}
                  className="shrink-0 h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
                  aria-label="Cancel video"
                >
                  <X className="w-5 h-5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSendVideoClip()}
                  disabled={isVideoUploading || isSending}
                  className="shrink-0 h-9 px-3 bg-[#7c5cfc] hover:bg-[#8b6dfc] text-white border-0"
                >
                  Send
                </Button>
              </div>
              {videoClipError && videoDraft ? (
                <p className="text-xs text-red-400" role="alert">
                  {videoClipError}
                </p>
              ) : null}
            </div>
          ) : null}

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
                    disabled={
                      isSending ||
                      status !== "active" ||
                      isVideoUploading ||
                      !!videoDraft
                    }
                    onClick={async (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      try {
                        bumpInteraction();
                        await sendMessage(id, "sticker");
                        setStickerConfetti((prev) => ({
                          seed: (prev?.seed ?? 0) + 1,
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        }));
                        setShowStickerTray(false);
                      } catch (err) {
                        console.error("[EventChatPage] sticker send failed", err);
                      }
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
              onClick={() => {
                setShowStickerTray((v) => !v);
              }}
              disabled={isSending || status !== "active" || isVideoUploading || !!videoDraft}
              aria-label="Stickers"
              aria-expanded={showStickerTray}
              aria-haspopup="dialog"
            >
              <Smile className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => videoInputRef.current?.click()}
              disabled={
                isSending ||
                status !== "active" ||
                isVideoUploading ||
                !!videoDraft ||
                showStickerTray
              }
              aria-label="Record or attach video"
              title="Video (max 60s)"
            >
              <Camera className="w-5 h-5" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => {
                bumpInteraction();
                setInputValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!inputValue.trim()) return;
                  const text = inputValue;
                  void (async () => {
                    try {
                      bumpInteraction();
                      await sendMessage(text);
                      setInputValue("");
                    } catch (err) {
                      console.error("[EventChatPage] send failed", err);
                    }
                  })();
                }
              }}
              className="flex-1 bg-white/5 border-white/10 focus-visible:ring-[#7c5cfc]/50 text-white placeholder:text-white/40 min-h-9"
              disabled={
                isSending ||
                status !== "active" ||
                isVideoUploading ||
                !!videoDraft ||
                showStickerTray
              }
            />
            <Button
              size="icon"
              onClick={async () => {
                if (!inputValue.trim()) return;
                const text = inputValue;
                try {
                  bumpInteraction();
                  await sendMessage(text);
                  setInputValue("");
                } catch (err) {
                  console.error("[EventChatPage] send failed", err);
                }
              }}
              disabled={
                isSending ||
                status !== "active" ||
                !inputValue.trim() ||
                isVideoUploading ||
                !!videoDraft ||
                showStickerTray
              }
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

