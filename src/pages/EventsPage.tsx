import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  MessageCircle,
  Check,
  Clock,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventChat } from "@/hooks/useEventChat";
import {
  type EventItem,
  fetchTicketmasterEvents,
} from "@/lib/ticketmaster";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { LoadingSpinner } from "@/components/LoadingSpinner";

// Fallback when no API key or API returns empty
const MOCK_EVENTS: EventItem[] = [
  {
    id: "tm1",
    name: "LCD Soundsystem",
    date: "Mar 15, 2026",
    eventStartAt: "2026-03-15T19:00:00Z",
    venue: "El Campín",
    city: "Bogotá",
    distance: "0.4 km",
    priceMin: 89,
    priceMax: 245,
    category: "Music",
    emoji: "🎵",
    chatCount: 87,
    ticketsSold: 1240,
    presaleCount: 420,
    isHot: true,
  },
  {
    id: "tm2",
    name: "Morat: Gira Mundial",
    date: "Mar 22, 2026",
    eventStartAt: "2026-03-22T20:00:00Z",
    venue: "Movistar Arena",
    city: "Bogotá",
    distance: "1.2 km",
    priceMin: 65,
    priceMax: 200,
    category: "Pop",
    emoji: "🎤",
    chatCount: 1204,
    ticketsSold: 8500,
    presaleCount: 3100,
    isHot: true,
  },
  {
    id: "tm3",
    name: "Filarmónica de Bogotá",
    date: "Mar 18, 2026",
    eventStartAt: "2026-03-18T19:30:00Z",
    venue: "Teatro Mayor",
    city: "Bogotá",
    distance: "2.1 km",
    priceMin: 45,
    priceMax: 180,
    category: "Classical",
    emoji: "🎻",
    chatCount: 34,
    ticketsSold: 312,
    presaleCount: 180,
    isHot: false,
  },
  {
    id: "tm4",
    name: "Botero: Exposición Aniversario",
    date: "Mar 14 – Jun 8",
    eventStartAt: "2026-03-14T10:00:00Z",
    venue: "Museo Botero",
    city: "Bogotá",
    distance: "2.8 km",
    priceMin: 20,
    priceMax: 50,
    category: "Art",
    emoji: "🎨",
    chatCount: 58,
    ticketsSold: 920,
    presaleCount: 200,
    isHot: false,
  },
  {
    id: "tm5",
    name: "J Balvin: Noche de Reggaetón",
    date: "Apr 5, 2026",
    eventStartAt: "2026-04-05T21:00:00Z",
    venue: "Parque Simón Bolívar",
    city: "Bogotá",
    distance: "3.3 km",
    priceMin: 75,
    priceMax: 350,
    category: "Pop",
    emoji: "🎶",
    chatCount: 432,
    ticketsSold: 12000,
    presaleCount: 5000,
    isHot: true,
  },
  {
    id: "tm6",
    name: "Comedy Night: Alejandro Riaño",
    date: "Mar 28, 2026",
    eventStartAt: "2026-03-28T20:00:00Z",
    venue: "Teatro Colsubsidio",
    city: "Bogotá",
    distance: "4.0 km",
    priceMin: 35,
    priceMax: 90,
    category: "Comedy",
    emoji: "😂",
    chatCount: 21,
    ticketsSold: 180,
    presaleCount: 95,
    isHot: false,
  },
];

const CATEGORIES = ["All", "Music", "Sports", "Art", "Comedy"];

const hue = (id: string) =>
  (parseInt(id.replace("tm", ""), 10) * 47) % 360;

const DEFAULT_EVENT_STARTS_AT = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function EventDetail({
  event,
  onClose,
  initialUnlock,
}: {
  event: EventItem;
  onClose: () => void;
  initialUnlock?: boolean;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isEnteringChat, setIsEnteringChat] = useState(false);
  const eventStartsAt = event.eventStartAt ?? DEFAULT_EVENT_STARTS_AT;

  const handleEnterChat = async () => {
    if (isEnteringChat) return;
    if (!user) {
      toast.error("Please sign in to unlock the group chat.");
      return;
    }
    try {
      setIsEnteringChat(true);
      // If already a member of this event chat, skip payment and go directly to chat
      console.log("[EventsPage] Before event_chat_members check", { eventId: event.id, userId: user.id });
      const { data: existingMember, error: memberError } = await supabase
        .from("event_chat_members")
        .select("event_id, paid_at, expires_at")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[EventsPage] After event_chat_members check", { eventId: event.id, userId: user.id, existingMember, memberError: memberError?.message });

      if (memberError) {
        console.log("[EventsPage] Error checking existing event_chat_members", memberError);
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

      if (existingMember) {
        const expiry = resolveMembershipExpiry(existingMember);
        if (!expiry || expiry.getTime() > Date.now()) {
          navigate(`/chat/event/${event.id}`);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to unlock the group chat.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-event-chat-payment", {
        body: {
          eventId: event.id,
          eventName: `${event.name} · ${event.venue}, ${event.city}`,
          eventStartsAt,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to create payment session");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("401") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authenticated")) {
        toast.error("Your session expired. Please sign in again.");
        await signOut();
        navigate("/auth", { state: { message: "Your session expired. Please sign in again." }, replace: true });
      } else {
        toast.error("Failed to process payment. Please try again.");
      }
    } finally {
      setIsEnteringChat(false);
    }
  };
  const {
    status,
    messages,
    senderMap,
    memberCount,
    minutesLeft,
    sendMessage,
    unlockChat,
    isSending,
  } = useEventChat({
    eventId: event.id,
    eventName: event.name,
    eventStartsAt,
  });
  const h = hue(event.id);

  useEffect(() => {
    if (initialUnlock && status === "locked") {
      unlockChat();
    }
  }, [initialUnlock, status, unlockChat]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-y-auto">
      {/* Hero */}
      <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">
        {event.imageUrl ? (
          <>
            <img
              src={event.imageUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-45"
            />
            <div className="absolute inset-0 bg-black/50" />
            <img
              src={event.imageUrl}
              alt={event.name}
              className="relative z-10 w-full h-full object-contain"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl bg-muted text-muted-foreground">
            🎵
          </div>
        )}
        <button
          type="button"
          className="absolute top-4 left-4 z-20 shrink-0 p-1.5 rounded-full bg-black/50 text-white/90 hover:text-white"
          onClick={onClose}
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {event.isHot && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            HOT 🔥
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pt-5 pb-24">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight mb-4">
          {event.name}
        </h1>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">{event.venue}, {event.city}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">{event.date}</span>
          </div>
        </div>
        {event.ticketsSold ? (
          <div className="flex items-center gap-2 mb-5 text-muted-foreground">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">
              {event.ticketsSold.toLocaleString()} tickets sold
            </span>
          </div>
        ) : null}

        {(() => {
          const url = event.ticketmasterUrl;
          const hasRealUrl =
            typeof url === "string" &&
            url.length > 30 &&
            (() => {
              try {
                const u = new URL(url);
                return u.pathname.length > 1;
              } catch {
                return false;
              }
            })();
          if (!hasRealUrl) return null;
          return (
            <div className="mt-1 mb-6">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base no-underline hover:opacity-90"
              >
                Get Tickets <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          );
        })()}

        <div className="flex items-center gap-2 mb-3 mt-1">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">
            Event Group Chat
          </span>
        </div>

        {status === "active" && minutesLeft !== null && (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-muted-foreground text-sm bg-muted/50">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Chat closes in {minutesLeft}m</span>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-border relative">
          {status === "active" && (
            <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2 bg-card/80">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(270, 55%, 28%), hsl(290, 45%, 18%))`,
                }}
              >
                {event.emoji}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{event.name}</p>
              </div>
            </div>
          )}
          <div className="p-4 bg-card/80 min-h-[120px]">
            {status === "loading" && (
              <div className="flex items-center justify-center py-8">
                <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {status === "locked" && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Button
                  onClick={handleEnterChat}
                  className="w-full rounded-full font-bold text-base py-3 h-auto"
                  disabled={isEnteringChat}
                >
                  {isEnteringChat ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  {isEnteringChat ? "Connecting..." : "Enter Group Chat"}
                </Button>
                <p className="text-muted-foreground text-xs mt-3">
                  One-time fee · Chat expires 12h after event starts
                </p>
              </div>
            )}
            {status === "active" && (
              <>
                {messages.map((m) => (
                  <div key={m.id} className="flex gap-2 mb-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{
                        background: `hsl(${(m.user_id.slice(0, 8).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360)}, 55%, 40%)`,
                      }}
                    >
                      {senderMap[m.user_id]?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex gap-2 items-center">
                        <span className="text-primary/90 text-xs font-semibold">
                          {senderMap[m.user_id]?.name ?? "User"}
                        </span>
                        <span className="text-muted-foreground/80 text-[11px]">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-foreground text-sm mt-0.5">{m.content}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
            {status === "expired" && (
              <p className="text-muted-foreground text-sm py-2">This chat ended 12 hours after the event 🎤</p>
            )}
            {status === "error" && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Button
                  onClick={handleEnterChat}
                  className="w-full rounded-full font-bold text-base py-3 h-auto"
                  disabled={isEnteringChat}
                >
                  {isEnteringChat ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  {isEnteringChat ? "Connecting..." : "Enter Group Chat"}
                </Button>
                <p className="text-muted-foreground text-xs mt-3">
                  One-time fee · Chat expires 12h after event starts
                </p>
              </div>
            )}
          </div>
        </div>

        {status === "active" && (
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message the group..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-foreground bg-card border border-border outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage(inputValue);
                  setInputValue("");
                }
              }}
            />
            <Button
              size="icon"
              className="w-10 h-10 rounded-xl shrink-0"
              disabled={isSending}
              onClick={async () => {
                await sendMessage(inputValue);
                setInputValue("");
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventsPage({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [initialUnlockEventId, setInitialUnlockEventId] = useState<string | null>(null);
  const [showEventChatSuccess, setShowEventChatSuccess] = useState(false);
  const [successEventId, setSuccessEventId] = useState<string | null>(null);
  const [successEventName, setSuccessEventName] = useState<string | null>(null);

  const { user } = useAuth();
  const { selectedCity, isLoading: isCityLoading, isCityOutOfRange, isManuallySelected } = useCity();

  const chatUnlockedId = searchParams.get("chat_unlocked") || searchParams.get("event_id");
  const paymentSuccess = searchParams.get("payment_success") === "true";

  useEffect(() => {
    // Only handle Stripe/payment redirects once events have finished loading
    if (!chatUnlockedId || eventsLoading || events.length === 0) return;
    const event = events.find((e) => e.id === chatUnlockedId);
    if (!event) {
      navigate("/events", { replace: true });
      return;
    }

    setSelected(event);
    setInitialUnlockEventId(chatUnlockedId);

    if (!paymentSuccess || !user) return;

    const createMembership = async () => {
      try {
        // 1. Upsert event_chats row with expires_at = eventStartAt + 12h (fallback: now + 12h)
        const start = event.eventStartAt ? new Date(event.eventStartAt) : new Date();
        const expiresAt = new Date(
          (isNaN(start.getTime()) ? Date.now() : start.getTime()) + 12 * 60 * 60 * 1000,
        );

        await supabase.from("event_chats").upsert(
          {
            event_id: chatUnlockedId,
            name: event.name,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: "event_id" },
        );

        const paidAt = new Date();
        const expiresAtFromStart = event.eventStartAt ? new Date(event.eventStartAt) : null;
        const hasValidStart = expiresAtFromStart && !isNaN(expiresAtFromStart.getTime());
        const membershipExpiresAt = hasValidStart
          ? new Date(expiresAtFromStart.getTime() + 12 * 60 * 60 * 1000)
          : new Date(paidAt.getTime() + 24 * 60 * 60 * 1000);

        // 2. Upsert event_chat_members row
        await supabase.from("event_chat_members").upsert(
          {
            event_id: chatUnlockedId,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            paid_at: paidAt.toISOString(),
            expires_at: membershipExpiresAt.toISOString(),
            event_name: event.name,
            event_venue: `${event.venue}, ${event.city}`,
            event_starts_at: event.eventStartAt ?? null,
          },
          { onConflict: "event_id,user_id" },
        );

        setSuccessEventId(chatUnlockedId);
        setSuccessEventName(event.name);
        setShowEventChatSuccess(true);
      } catch (error) {
        console.log("[EventsPage] Error creating membership after payment redirect", error);
      }
    };

    void createMembership();
  }, [chatUnlockedId, paymentSuccess, eventsLoading, events, user, navigate]);

  useEffect(() => {
    if (!selected) setInitialUnlockEventId(null);
  }, [selected]);

  useEffect(() => {
    if (showEventChatSuccess) {
      triggerConfettiWaterfall();
    }
  }, [showEventChatSuccess]);

  useEffect(() => {
    let cancelled = false;
    // Manual pick (e.g. NYC from picker): never block events API — out-of-range only applies to auto-detected location
    if (isCityOutOfRange && !isManuallySelected) {
      console.log("[EventsPage] skip fetch — out of range (auto-detected)", {
        isCityOutOfRange,
        isManuallySelected,
      });
      setEventsLoading(false);
      setEvents([]);
      return () => {
        cancelled = true;
      };
    }
    if (isCityLoading || !selectedCity) {
      setEventsLoading(true);
      return () => {
        cancelled = true;
      };
    }
    setEventsLoading(true);
    fetchTicketmasterEvents({ radius: 50, size: 50, city: selectedCity })
      .then((list) => {
        console.log("[EventsPage] fetchTicketmasterEvents resolved", {
          rawLength: Array.isArray(list) ? list.length : "not-array",
          rawSample: Array.isArray(list) ? list.slice(0, 2) : list,
          cancelled,
        });
        if (!cancelled) {
          setEvents(list);
          console.log("[EventsPage] setEvents applied", {
            length: list.length,
            categories: [...new Set(list.map((e) => e.category))],
          });
        } else {
          console.log("[EventsPage] setEvents skipped (effect cancelled)");
        }
      })
      .catch((err) => {
        console.error("[EventsPage] fetchTicketmasterEvents rejected", err);
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCity, isCityLoading, isCityOutOfRange, isManuallySelected]);

  /** Ticketmaster/edge currently tag most API events as "Music" — other tabs would show empty unless we reset */
  useEffect(() => {
    setCat("All");
  }, [selectedCity]);

  useEffect(() => {
    if (events.length === 0 || cat === "All") return;
    const n = events.filter((e) => e.category === cat).length;
    if (n === 0) {
      console.log("[EventsPage] category filter matched 0 events — resetting to All", {
        cat,
        availableCategories: [...new Set(events.map((e) => e.category))],
      });
      setCat("All");
    }
  }, [events, cat]);

  const hot = useMemo(() => events.filter((e) => e.isHot), [events]);
  const filtered =
    cat === "All"
      ? events
      : events.filter((e) => e.category === cat);

  useEffect(() => {
    const filteredCount =
      cat === "All" ? events.length : events.filter((e) => e.category === cat).length;
    const hotCount = events.filter((e) => e.isHot).length;
    console.log("[EventsPage] filter/render snapshot", {
      eventsCount: events.length,
      cat,
      filteredCount,
      hotCount,
    });
  }, [events, cat]);

  return (
    <div className="w-full min-h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (onClose ? onClose() : navigate(-1))}
              className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Near You
            </h1>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:border-primary/30"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Happening Soon */}
        {!eventsLoading && hot.length > 0 && (
          <div className="pt-5 pb-2">
            <div className="flex items-center gap-2 px-5 mb-3">
              <span>🔥</span>
              <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Happening Soon
              </span>
            </div>
            <div className="flex gap-3 px-5 overflow-x-auto pb-2 scrollbar-hide">
              {hot.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e)}
                  className="shrink-0 w-[200px] rounded-2xl overflow-hidden bg-card border border-border text-left hover:border-primary/30 transition-colors"
                >
                  <div
                    className="h-28 relative overflow-hidden rounded-t-2xl"
                    style={
                      !e.imageUrl
                        ? { background: `linear-gradient(135deg, hsl(${hue(e.id)}, 55%, 22%), hsl(${(hue(e.id) + 120) % 360}, 45%, 13%))` }
                        : undefined
                    }
                  >
                    {e.imageUrl && (
                      <img
                        src={e.imageUrl}
                        className="w-full h-full object-cover absolute inset-0"
                        alt={e.name}
                        onError={(ev) => {
                          const target = ev.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                      HOT
                    </div>
                    <div className="absolute bottom-2 left-2.5 text-2xl">
                      {e.emoji}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-foreground text-sm leading-snug mb-1">
                      {e.name}
                    </p>
                    <p className="text-muted-foreground text-xs mb-1.5">
                      {e.date}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.ticketsSold ? (
                        <span className="text-xs text-muted-foreground">
                          {e.ticketsSold.toLocaleString()} sold
                        </span>
                      ) : null}
                      {"presaleCount" in e && e.presaleCount ? (
                        <span className="text-xs text-muted-foreground">
                          {e.presaleCount.toLocaleString()} presale
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Nearby */}
        <div className="pt-4 pb-8">
          <div className="flex items-center gap-2 px-5 mb-3">
            <span>📍</span>
            <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              All Nearby
            </span>
          </div>
          {isCityOutOfRange && !isManuallySelected ? (
            <div className="mx-4 rounded-2xl overflow-hidden bg-card/50 border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                SHAKE is coming to your city soon 🌍 Stay tuned!
              </p>
            </div>
          ) : eventsLoading ? (
            <div className="mx-4 rounded-2xl overflow-hidden bg-card/50 border border-border p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-14 rounded-xl bg-muted/60" />
                <div className="h-14 rounded-xl bg-muted/60" />
                <div className="h-14 rounded-xl bg-muted/60" />
                <div className="h-14 rounded-xl bg-muted/60" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-4 rounded-2xl overflow-hidden bg-card/50 border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No events in {selectedCity ?? "this city"} yet — check back soon 🔥
              </p>
            </div>
          ) : (
          <div className="mx-4 rounded-2xl overflow-hidden bg-card/50 border border-border">
            {filtered.map((e, i) => (
              <div key={e.id}>
                {i > 0 && <div className="h-px bg-border/70 mx-4" />}
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="w-full flex items-center gap-3 py-3.5 px-4 bg-transparent border-0 cursor-pointer text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {e.imageUrl
                      ? <img src={e.imageUrl} alt={e.name} className="w-full h-full object-cover object-top" />
                      : <span className="text-2xl">🎵</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm mb-0.5 truncate">
                      {e.name}
                    </p>
                    <p className="text-muted-foreground text-xs mb-1 truncate">
                      {e.venue} · {e.date}
                    </p>
                    <div className="flex gap-3 items-center flex-wrap">
                      {(e.priceMin != null && e.priceMax != null && e.priceMin > 0 && e.priceMax > 0) ? (
                        <span className="text-primary text-xs font-medium">
                          ${e.priceMin}–${e.priceMax}
                        </span>
                      ) : null}
                      {e.ticketsSold ? (
                        <div className="flex items-center gap-1">
                          <Users className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-[11px]">
                            {e.ticketsSold.toLocaleString()} sold
                          </span>
                        </div>
                      ) : null}
                      {"presaleCount" in e && (
                        <span className="text-muted-foreground text-[11px]">
                          {e.presaleCount.toLocaleString()} presale
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {e.distance ? (
                      <p className="text-muted-foreground text-xs mb-1">
                        {e.distance}
                      </p>
                    ) : null}
                    {e.isHot && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/30 text-primary">
                        HOT
                      </span>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
          )}
          <p className="text-center text-muted-foreground/70 text-[11px] mt-5 px-6">
            Powered by Ticketmaster · Purchases on ticketmaster.com
          </p>
        </div>
      </div>

      {selected && (
        <EventDetail
          event={selected}
          onClose={() => setSelected(null)}
          initialUnlock={selected.id === initialUnlockEventId}
        />
      )}

      {showEventChatSuccess && successEventId && successEventName && (
        <Dialog
          open={showEventChatSuccess}
          onOpenChange={(open) => {
            if (!open) setShowEventChatSuccess(false);
          }}
        >
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <div
                className="animate-scale-in"
                style={{ animationDuration: "0.4s" }}
              >
                <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <span className="text-4xl">🎉</span>
                </div>
              </div>
              <div
                className="text-center animate-fade-in"
                style={{ animationDelay: "0.2s" }}
              >
                <h2 className="text-2xl font-display font-bold text-foreground">
                  You&apos;re in!
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  You now have access to the Event Group Chat for
                  <br />
                  <span className="font-semibold">{successEventName}</span>
                </p>
              </div>
              <div
                className="animate-scale-in"
                style={{ animationDelay: "0.3s" }}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p
                className="text-xs text-muted-foreground/80 text-center max-w-xs animate-fade-in"
                style={{ animationDelay: "0.4s" }}
              >
                Join the group chat now to meet other fans and coordinate before the event.
              </p>
              <Button
                className="mt-2 w-full rounded-full font-semibold"
                onClick={() => {
                  setShowEventChatSuccess(false);
                  navigate(`/chat/event/${successEventId}`, { replace: true });
                }}
              >
                Go to Chat
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
