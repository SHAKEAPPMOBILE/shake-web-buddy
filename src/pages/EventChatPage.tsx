import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Users, Clock, Bell, BellOff, LogOut, Images, Camera } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import { supabase } from "@/integrations/supabase/client";
import type { EventChatLocationState } from "@/lib/eventChatNavigation";
import { resolveEventChatPosterUrl } from "@/lib/eventChatEventPoster";
import { isEventChatMembershipExplicitlyExpired } from "@/lib/eventChatMembership";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatStatus } from "@/hooks/useEventChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { InlineChatGif } from "@/components/chat/InlineChatGif";
import { EVENT_CHAT_VIDEO_MAX_SECONDS, uploadEventChatVideoWithProgress } from "@/lib/eventChatVideoUpload";
import { useEventChatReactions } from "@/hooks/useEventChatReactions";
import { useMessageReactionBarState } from "@/hooks/useMessageReactionBarState";
import { MessageBubbleReactions } from "@/components/chat/MessageBubbleReactions";
import { aggregateReactionsByMessage, sortedReactionEntries } from "@/lib/eventChatReactions";
import { markEventChatViewedNow } from "@/lib/eventChatLastSeen";

interface EventChatPageParams {
  eventId?: string;
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
  const [polaroidExpanded, setPolaroidExpanded] = useState(false);
  const [eventDate, setEventDate] = useState<string>("");
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [hasFatalError, setHasFatalError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
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
    if (!eventId || !user) return;
    markEventChatViewedNow(eventId);
  }, [eventId, user?.id]);

  useEffect(() => {
    if (!prefetchStart) return;
    const d = new Date(prefetchStart);
    if (Number.isNaN(d.getTime())) return;
    setEventDate(d.toLocaleDateString([], { month: "short", day: "numeric" }));
  }, [prefetchStart]);

  /**
   * Polaroid: `public_events.image_url` (Supabase) or Ticketmaster Discovery event detail `images` (widest first).
   * Optional `eventPrefetch.imageUrl` only fills the gap until resolve completes (e.g. confirmation modal).
   */
  useEffect(() => {
    if (!eventId) return;
    setPolaroidExpanded(false);
    const prefetchUrl = (location.state as EventChatLocationState | null)?.eventPrefetch?.imageUrl?.trim() || null;
    setEventImageUrl(prefetchUrl);

    let cancelled = false;
    void (async () => {
      const { posterUrl, ticketmasterImagesLog } = await resolveEventChatPosterUrl(eventId);
      if (cancelled) return;
      if (ticketmasterImagesLog?.length) {
        console.log("[EventChatPage] Ticketmaster event.images (detail API)", ticketmasterImagesLog);
      }
      if (posterUrl) {
        setEventImageUrl(posterUrl);
        return;
      }
      setEventImageUrl(prefetchUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, location.key]);

  useEffect(() => {
    console.log("[EventChatPage] Polaroid header <img> src", {
      eventImageUrl: eventImageUrl ?? null,
      eventId: eventId ?? null,
      isNullish: eventImageUrl == null || eventImageUrl === "",
    });
  }, [eventImageUrl, eventId]);

  useEffect(() => {
    if (!polaroidExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPolaroidExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [polaroidExpanded]);

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

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactionsEnabled =
    !!eventId && chatDataLoadEnabled && status === "active" && !!user;
  const { rows: reactionRows, toggleReaction } = useEventChatReactions({
    eventId: eventId ?? "",
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
        clearNoMemberExitTimer();

        console.log("[EventChatPage] event chats now free for logged-in users — enabling chat data immediately", {
          eventId,
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

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Auto-scroll when list changes; rAF so flex/media layout (e.g. GIF height) is applied first
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => scrollMessagesToBottom("smooth"));
    return () => cancelAnimationFrame(id);
  }, [messages, scrollMessagesToBottom]);

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
    {polaroidExpanded && eventImageUrl ? (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
        onClick={() => setPolaroidExpanded(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Event poster"
      >
        <img
          src={eventImageUrl}
          alt={eventName}
          className="max-h-[min(85dvh,900px)] max-w-full w-auto object-contain rounded shadow-2xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ) : null}
    {eventId && user ? (
      <VideoUploadModal
        open={videoModalOpen}
        onOpenChange={setVideoModalOpen}
        title="Video"
        maxDurationSeconds={EVENT_CHAT_VIDEO_MAX_SECONDS}
        floatingSendUsesChatPurple
        primaryButtonLabel="Send"
        uploadSuccessToast="Video sent!"
        uploadErrorToast="Failed to send video"
        onUploadFile={async (file, onProgress) => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) return false;
          bumpInteraction();
          try {
            const publicUrl = await uploadEventChatVideoWithProgress(
              file,
              user.id,
              eventId,
              session.access_token,
              onProgress
            );
            await sendMessage(publicUrl, "video");
            setGiphyPickerOpen(false);
            return true;
          } catch (err) {
            console.error("[EventChatPage] video upload/send failed", err);
            return false;
          }
        }}
      />
    ) : null}
    {eventId && user ? (
      <EventChatGiphyPickerModal
        open={giphyPickerOpen}
        onOpenChange={setGiphyPickerOpen}
        onGifSelect={async (url) => {
          bumpInteraction();
          await sendMessage(url, "gif");
        }}
      />
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
        <div className="relative z-30 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))]">
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
            {eventImageUrl ? (
              <button
                type="button"
                className="shrink-0 flex flex-col items-center text-left border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cfc]/70 rounded-sm"
                style={{
                  background: "white",
                  padding: "3px 3px 8px 3px",
                  borderRadius: "2px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  transform: "rotate(-2deg)",
                  width: "46px",
                }}
                aria-label="Expand event poster"
                onClick={() => setPolaroidExpanded(true)}
              >
                <img
                  src={eventImageUrl}
                  alt=""
                  style={{ width: "40px", height: "40px", objectFit: "cover", display: "block" }}
                />
                <span style={{ fontSize: "6px", color: "#555", marginTop: "2px", maxWidth: "40px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {eventDate || "—"}
                </span>
              </button>
            ) : (
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
                aria-hidden
              >
                <div
                  className="flex items-center justify-center bg-zinc-200 text-zinc-600 text-lg leading-none select-none"
                  style={{ width: "40px", height: "40px" }}
                >
                  🎵
                </div>
                <span style={{ fontSize: "6px", color: "#555", marginTop: "2px", maxWidth: "40px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {eventDate || "—"}
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

        {/* Chat body — extra bottom padding so last message clears the input bar */}
        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto space-y-3 px-4 pt-14 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
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
            const isVideo = m.message_type === "video" && /^https?:\/\//i.test(m.content);
            const isGif = m.message_type === "gif" && /^https?:\/\//i.test(m.content);

            const msgReactions = reactionsByMessage[m.id];
            const reactionChips = msgReactions ? sortedReactionEntries(msgReactions) : [];

            return (
              <div key={m.id} className={`flex gap-3 items-end ${isOwn ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/5">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-white/5 flex items-center justify-center">
                    <span className="text-xs text-white/40">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`w-fit max-w-[70%] min-w-0 ${isGif || isVideo ? "shrink-0 overflow-visible" : ""} ${isOwn ? "text-right" : "text-left"}`}
                >
                  <MessageBubbleReactions
                    variant="dark"
                    isOwn={isOwn}
                    messageId={m.id}
                    enabled={reactionsEnabled}
                    reactionBarMessageId={reactionBarMessageId}
                    mobileReactionBarRef={mobileReactionBarRef}
                    reactionChips={reactionChips}
                    onToggleReaction={toggleReaction}
                    onInteraction={bumpInteraction}
                    onPointerDown={onMessagePointerDown(m.id)}
                    onPointerUp={onMessagePointerEnd}
                    onPointerCancel={onMessagePointerEnd}
                    onPointerLeave={onMessagePointerEnd}
                    header={
                      <div className={`flex items-baseline gap-2 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
                        <span className="font-semibold text-sm text-white">
                          {isOwn ? "You" : displayName}
                        </span>
                        <span className="text-xs text-white/35">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    }
                  >
                    {isVideo ? (
                      <video
                        src={m.content}
                        controls
                        playsInline
                        preload="metadata"
                        className="rounded-lg max-w-[260px] w-full bg-black/30"
                      />
                    ) : isGif ? (
                      <InlineChatGif
                        src={m.content}
                        variant="dark"
                        onLoad={() => scrollMessagesToBottom("smooth")}
                      />
                    ) : (
                      <div
                        className={`text-sm px-3 py-2 rounded-xl inline-block text-left ${
                          isOwn ? "bg-[#7c5cfc] text-white" : "bg-white/10 text-white border border-white/10"
                        }`}
                      >
                        <span>{m.content}</span>
                      </div>
                    )}
                  </MessageBubbleReactions>
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

          <div
            ref={messagesEndRef}
            className="h-px w-full shrink-0 scroll-mb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            aria-hidden
          />
        </div>

        {/* Input bar */}
        <div className="relative p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setGiphyPickerOpen(true)}
              disabled={isSending || status !== "active" || videoModalOpen}
              aria-label="GIFs"
              title="GIFs"
            >
              <Images className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setVideoModalOpen(true)}
              disabled={
                isSending ||
                status !== "active" ||
                videoModalOpen ||
                giphyPickerOpen
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
                      console.log("[EventChatPage] send text", {
                        routeEventId: eventId,
                        chatStatus: status,
                      });
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
                videoModalOpen ||
                giphyPickerOpen
              }
            />
            <Button
              size="icon"
              onClick={async () => {
                if (!inputValue.trim()) return;
                const text = inputValue;
                try {
                  bumpInteraction();
                  console.log("[EventChatPage] send text (button)", {
                    routeEventId: eventId,
                    chatStatus: status,
                  });
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
                videoModalOpen ||
                giphyPickerOpen
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

