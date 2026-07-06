import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Users, Clock, Bell, BellOff, LogOut, Images, Camera } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import { supabase } from "@/integrations/supabase/client";
import type { EventChatLocationState } from "@/lib/eventChatNavigation";
import { resolveEventChatPosterUrl } from "@/lib/eventChatEventPoster";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatStatus } from "@/hooks/useEventChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { PremiumDialog } from "@/components/PremiumDialog";
import { EventChatGiphyPickerModal } from "@/components/eventChat/EventChatGiphyPickerModal";
import { checkMonthlyVideoLimit } from "@/lib/videoLimit";
import { InlineChatGif } from "@/components/chat/InlineChatGif";
import { EVENT_CHAT_VIDEO_MAX_SECONDS, uploadEventChatVideoWithProgress } from "@/lib/eventChatVideoUpload";
import { useEventChatReactions } from "@/hooks/useEventChatReactions";
import { useMessageReactionBarState } from "@/hooks/useMessageReactionBarState";
import { MessageBubbleReactions } from "@/components/chat/MessageBubbleReactions";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { aggregateReactionsByMessage, sortedReactionEntries } from "@/lib/eventChatReactions";
import { markEventChatViewedNow } from "@/lib/eventChatLastSeen";
import { removePendingEventChat } from "@/lib/pendingEventChat";
import { useTranslation } from "react-i18next";

interface EventChatPageParams {
  eventId?: string;
}

export default function EventChatPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<EventChatPageParams>();
  const navigate = useNavigate();
  const location = useLocation();
  const chatNavState = location.state as EventChatLocationState | null;
  const prefetch = chatNavState?.eventPrefetch;

  const navigateBackFromEventChat = useCallback(() => {
    const mode = (location.state as EventChatLocationState | null)?.eventsReturn?.mode;
    if (mode === "home_near_you") {
      navigate("/", { replace: true, state: { openEvents: true } });
      return;
    }
    if (mode === "standalone_events") {
      navigate("/events", { replace: true });
      return;
    }
    navigate(-1);
  }, [navigate, location.state]);

  const prefetchStart =
    prefetch?.eventStartsAt && !Number.isNaN(new Date(prefetch.eventStartsAt).getTime())
      ? prefetch.eventStartsAt
      : null;

  const { user, isPremium, isLoading: authLoading } = useAuth();
  const [eventName, setEventName] = useState<string>(() => prefetch?.name?.trim() || t('chat.eventChat', 'Event Chat'));
  const [eventStartsAt, setEventStartsAt] = useState<string | null>(
    () => prefetchStart ?? null
  );
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(() => prefetch?.imageUrl ?? null);
  const [polaroidExpanded, setPolaroidExpanded] = useState(false);
  const [eventDate, setEventDate] = useState<string>("");
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [hasFatalError, setHasFatalError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const lastInteractionRef = useRef<number>(Date.now());
  const bumpInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!eventId || !user) return;
    markEventChatViewedNow(eventId);
    // Also save to Supabase so iOS native app can read it
    supabase.from("activity_read_status").upsert({
      user_id: user.id,
      activity_type: eventId,
      city: "event",
      last_read_at: new Date().toISOString(),
    }, { onConflict: "user_id,activity_type,city" });
  }, [eventId, user?.id]);

  useEffect(() => {
    if (!prefetchStart) return;
    const d = new Date(prefetchStart);
    if (Number.isNaN(d.getTime())) return;
    setEventDate(d.toLocaleDateString([], { month: "short", day: "numeric" }));
  }, [prefetchStart]);

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
        console.log("[EventChatPage] Ticketmaster event.images", ticketmasterImagesLog);
      }
      if (posterUrl) {
        setEventImageUrl(posterUrl);
        return;
      }
      setEventImageUrl(prefetchUrl);
    })();

    return () => { cancelled = true; };
  }, [eventId, location.key]);

  useEffect(() => {
    if (!polaroidExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPolaroidExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [polaroidExpanded]);

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

  // Chat is free for all authenticated users — always enabled
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
    loadEnabled: true,
  });

  useEffect(() => {
    chatStatusRef.current = "loading";
  }, [eventId]);

  useEffect(() => {
    chatStatusRef.current = status;
  }, [status]);

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactionsEnabled = !!eventId && status === "active" && !!user;

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

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => scrollMessagesToBottom("smooth"));
    return () => cancelAnimationFrame(id);
  }, [messages, scrollMessagesToBottom]);


  const dateLine = (location.state as any)?.dateLine ?? null;
  // Split header date into day / date / time for separate lines
  const { headerDay: evtHeaderDay, headerDateOnly: evtHeaderDate, headerTime: evtHeaderTime } = useMemo(() => {
    if (status === "expired") return { headerDay: t('chat.eventExpired', 'This chat ended 12h after the event 🎤'), headerDateOnly: null, headerTime: null };
    if (dateLine) return { headerDay: dateLine as string, headerDateOnly: null, headerTime: null };
    if (status === "error") return { headerDay: t('chat.eventError', 'Something went wrong. Try again.'), headerDateOnly: null, headerTime: null };
    if (eventStartsAt) {
      const d = new Date(eventStartsAt);
      if (!Number.isNaN(d.getTime())) {
        const today = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const isToday = d.toDateString() === today.toDateString();
        const isTomorrow = d.toDateString() === tomorrow.toDateString();
        const day = isToday ? t('common.today', 'Today') : isTomorrow ? t('common.tomorrow', 'Tomorrow') : d.toLocaleDateString('en-US', { weekday: 'long' });
        const date = (isToday || isTomorrow) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return { headerDay: day, headerDateOnly: date, headerTime: time };
      }
    }
    if (minutesLeft !== null && (status === "active" || status === "loading")) {
      return { headerDay: t('chat.closesInMinutes', 'Chat closes in {{minutes}}m', { minutes: minutesLeft }), headerDateOnly: null, headerTime: null };
    }
    if (status === "loading") return { headerDay: t('chat.loadingMessages', 'Loading messages…'), headerDateOnly: null, headerTime: null };
    return { headerDay: t('chat.eventMessagesHere', 'Messages from this event will appear here.'), headerDateOnly: null, headerTime: null };
  }, [minutesLeft, status, eventStartsAt, dateLine, t]);

  if (!eventId) return null;

  return (
    <>
      {polaroidExpanded && eventImageUrl ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPolaroidExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('chat.eventPosterLabel', 'Event poster')}
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
          primaryButtonLabel={t('chat.send', 'Send')}
          uploadSuccessToast={t('chat.videoSent', 'Video sent!')}
          uploadErrorToast={t('chat.failedToSendVideo', 'Failed to send video')}
          onUploadFile={async (file, onProgress) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return false;
            bumpInteraction();
            try {
              const publicUrl = await uploadEventChatVideoWithProgress(
                file, user.id, eventId, session.access_token, onProgress
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

      <PremiumDialog open={premiumDialogOpen} onOpenChange={setPremiumDialogOpen} />

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

      <div className="fixed inset-0 z-40 flex min-h-[100dvh] flex-col">
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
          <div className="relative z-30 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <MinimalBackButton
              onClick={navigateBackFromEventChat}
              className="shrink-0 text-white/80 hover:text-white"
              aria-label={t('common.back', 'Back')}
              iconClassName="w-6 h-6"
            />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {eventImageUrl ? (
                <button
                  type="button"
                  className="shrink-0 flex flex-col items-center text-left border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded-sm"
                  style={{
                    background: "white",
                    padding: "3px 3px 8px 3px",
                    borderRadius: "2px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    transform: "rotate(-2deg)",
                    width: "46px",
                  }}
                  aria-label={t('chat.expandEventPoster', 'Expand event poster')}
                  onClick={() => setPolaroidExpanded(true)}
                >
                  <img
                    src={eventImageUrl}
                    alt=""
                    style={{ width: "40px", height: "52px", objectFit: "contain", display: "block", background: "white" }}
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
                <h1 className="text-xl font-bold text-white truncate">{eventName}</h1>
                <div className="mt-0.5">
                  <p className="text-sm font-semibold text-white/80 leading-tight">{evtHeaderDay}</p>
                  {evtHeaderDate && <p className="text-xs text-white/60 leading-tight">{evtHeaderDate}</p>}
                  {evtHeaderTime && <p className="text-xs text-white/60 leading-tight">{evtHeaderTime}</p>}
                </div>
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
                title={isMuted ? t('chat.unmute', 'Unmute') : t('chat.mute', 'Mute')}
              >
                {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!user?.id) return;
                  await supabase
                    .from("event_chat_members")
                    .delete()
                    .eq("event_id", eventId)
                    .eq("user_id", user.id);
                  // Clear the pending-chat entry so the chat list doesn't re-show
                  // this event from the optimistic sessionStorage cache after leaving.
                  if (eventId) removePendingEventChat(eventId);
                  navigateBackFromEventChat();
                }}
                className="shrink-0 text-white/50 hover:text-red-400 hover:bg-white/5 h-8 w-8"
                title={t('chat.leaveChat', 'Leave chat')}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat body */}
          <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto space-y-3 px-4 pt-4 pb-4">
            {status === "loading" && (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            )}

            {status === "active" && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <p className="text-center text-sm">
                  {t('chat.startTheConversation', 'Start the conversation!')}<br />
                  <span className="text-xs">{t('chat.eventMessagesHere', 'Messages from this event will appear here.')}</span>
                </p>
              </div>
            )}

            {messages.map((m) => {
              const profile = senderMap[m.user_id];
              const displayName = profile?.name || t('chat.shaker', 'Shaker');
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
                      <span className="text-xs text-white/40">{displayName.charAt(0).toUpperCase()}</span>
                    </AvatarFallback>
                  </Avatar>
                  <div className={`w-fit max-w-[70%] min-w-0 ${isGif || isVideo ? "shrink-0 overflow-visible" : ""} ${isOwn ? "text-right" : "text-left"}`}>
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
                          <span className="font-semibold text-sm text-white">{isOwn ? t('chat.you', 'You') : displayName}</span>
                          <span className="text-xs text-white/35">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      }
                    >
                      {isVideo ? (
                        <video src={m.content} controls playsInline preload="metadata" className="rounded-2xl max-w-[260px] w-full bg-black/30" />
                      ) : isGif ? (
                        <InlineChatGif src={m.content} variant="dark" onLoad={() => scrollMessagesToBottom("smooth")} />
                      ) : (
                        <div
                          className="text-sm px-3 py-2 inline-block text-left"
                          style={isOwn ? {
                            background: "rgba(139, 92, 246, 0.55)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            borderRadius: "18px 18px 4px 18px",
                            color: "white",
                          } : {
                            background: "rgba(255,255,255,0.45)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.4)",
                            borderRadius: "18px 18px 18px 4px",
                            color: "#111",
                          }}
                        >
                          <span>{m.content}</span>
                        </div>
                      )}
                    </MessageBubbleReactions>
                  </div>
                </div>
              );
            })}

            {hasFatalError && (
              <p className="text-xs text-red-400 text-center mt-4">
                {t('chat.fatalError', 'Something went wrong loading this chat. Please try again later.')}
              </p>
            )}

            <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
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
                onClick={() => {
                  if (isPremium) {
                    setVideoModalOpen(true);
                    return;
                  }
                  checkMonthlyVideoLimit(user!.id).then(({ limitReached }) => {
                    if (limitReached) {
                      setPremiumDialogOpen(true);
                    } else {
                      setVideoModalOpen(true);
                    }
                  });
                }}
                disabled={isSending || status !== "active" || videoModalOpen || giphyPickerOpen}
                aria-label="Record or attach video"
                title="Video (max 60s)"
              >
                <Camera className="w-5 h-5" />
              </Button>
              <Input
                placeholder={t('chat.typeMessage', 'Type a message...')}
                value={inputValue}
                onChange={(e) => { bumpInteraction(); setInputValue(e.target.value); }}
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
                className="flex-1 bg-white/5 border-white/10 focus-visible:ring-black/20 text-white placeholder:text-white/40 min-h-9"
                disabled={isSending || status !== "active" || videoModalOpen || giphyPickerOpen}
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
                disabled={isSending || status !== "active" || !inputValue.trim() || videoModalOpen || giphyPickerOpen}
                className="shrink-0 h-9 w-9 bg-black hover:bg-black/80 text-white border-0"
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
