import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  MessageCircle,
  Lock,
  X,
  Check,
  Clock,
} from "lucide-react";
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

const CATEGORIES = ["All", "Music", "Classical", "Pop", "Art", "Comedy"];

const hue = (id: string) =>
  (parseInt(id.replace("tm", ""), 10) * 47) % 360;

function PaymentModal({
  event,
  eventStartsAt,
  onClose,
}: {
  event: EventItem;
  eventStartsAt: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-chat-payment", {
        body: { eventId: event.id, eventName: event.name, eventStartsAt },
      });

      if (error) {
        toast.error(error.message ?? "Failed to start payment");
        setLoading(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("Failed to create payment session");
      setLoading(false);
    } catch {
      toast.error("Failed to process payment. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[420px] rounded-t-[28px] bg-card border border-border overflow-hidden">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-primary/30" />
        </div>
        <div className="p-6 pt-2 pb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-bold text-foreground text-lg">Join Group Chat</p>
              <p className="text-muted-foreground text-sm">{event.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="rounded-2xl p-4 bg-primary/10 border border-primary/20 mb-5">
            <div className="flex justify-between mb-2">
              <span className="text-primary/90 text-sm">Chat access fee</span>
              <span className="text-foreground font-semibold">$1.00</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary/15">
              <span className="text-foreground font-medium text-sm">Total</span>
              <span className="text-foreground font-bold">$1.00</span>
            </div>
          </div>
          <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full h-12 rounded-2xl font-bold text-base"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              "Pay $1.00 · Unlock Chat"
            )}
          </Button>
          <p className="text-center text-muted-foreground text-xs mt-3">
            Secure · No subscription
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const eventStartsAt = event.eventStartAt ?? DEFAULT_EVENT_STARTS_AT;
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
      <div
        className="relative h-56 flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${h}, 55%, 18%), hsl(${(h + 120) % 360}, 45%, 10%))`,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-black/50 hover:bg-black/60 text-white border-0"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {event.isHot && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            HOT 🔥
          </div>
        )}
        <div className="absolute bottom-4 left-4 text-4xl">{event.emoji}</div>
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{
            background: "linear-gradient(transparent, hsl(var(--background)))",
          }}
        />
      </div>

      <div className="flex-1 px-5 pb-20">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight mb-4">
          {event.name}
        </h1>
        {[
          { Icon: MapPin, t: `${event.venue}, ${event.city}` },
          { Icon: Calendar, t: event.date },
          { Icon: Users, t: `${event.ticketsSold.toLocaleString()} tickets sold` },
        ].map(({ Icon, t }, i) => (
          <div
            key={i}
            className="flex items-center gap-2 mb-2 text-muted-foreground"
          >
            <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-sm">{t}</span>
          </div>
        ))}

        <div className="rounded-2xl p-4 bg-card border border-border flex items-center justify-between mt-5 mb-5">
          <div>
            <p className="text-muted-foreground text-xs">Tickets on Ticketmaster</p>
            <p className="text-foreground font-bold text-lg">
              ${event.priceMin}–${event.priceMax}
            </p>
          </div>
          <a
            href={event.ticketmasterUrl ?? "https://www.ticketmaster.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm no-underline hover:opacity-90"
          >
            Buy <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">
              Event Group Chat
            </span>
          </div>
          <span className="text-muted-foreground text-sm">
            {status === "active" ? memberCount : event.chatCount} members
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
                <div className="flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-[11px]">
                    {event.chatCount.toLocaleString()} members
                  </span>
                </div>
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
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div
                  className="w-full rounded-2xl p-5 mb-5 flex flex-col items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, hsl(270, 55%, 28%), hsl(290, 45%, 18%))",
                  }}
                >
                  <MessageCircle className="w-8 h-8 text-white/90 mb-1" />
                  <p className="text-white font-bold text-base leading-snug">{event.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-white/70 text-xs">
                      {event.chatCount.toLocaleString()} people in this chat
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => setShowPayment(true)}
                  className="w-full rounded-full font-bold text-base py-3 h-auto"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enter Group Chat · $1
                </Button>
                <p className="text-muted-foreground text-xs mt-3">One-time fee · Ticket holders only</p>
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
              !user ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center mb-3">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-foreground font-bold">Unlock for $1</p>
                  <p className="text-muted-foreground text-xs mt-1 text-center px-8">Chat with everyone attending</p>
                  <Button onClick={() => setShowPayment(true)} className="mt-4 rounded-xl font-bold">
                    Join Chat · $1
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-2">Couldn&apos;t load chat. Try again.</p>
              )
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

      {showPayment && (
        <PaymentModal
          event={event}
          eventStartsAt={eventStartsAt}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}

export default function EventsPage({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<EventItem[]>(MOCK_EVENTS);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [initialUnlockEventId, setInitialUnlockEventId] = useState<string | null>(null);

  const chatUnlockedId = searchParams.get("chat_unlocked");

  useEffect(() => {
    if (!chatUnlockedId || events.length === 0) return;
    const event = events.find((e) => e.id === chatUnlockedId);
    if (event) {
      setSelected(event);
      setInitialUnlockEventId(chatUnlockedId);
    }
    navigate("/events", { replace: true });
  }, [chatUnlockedId, events, navigate]);

  useEffect(() => {
    if (!selected) setInitialUnlockEventId(null);
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    fetchTicketmasterEvents({ radius: 50, size: 25 })
      .then((list) => {
        if (!cancelled) {
          setEvents(list.length > 0 ? list : MOCK_EVENTS);
        }
      })
      .catch(() => {
        if (!cancelled) setEvents(MOCK_EVENTS);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hot = useMemo(() => events.filter((e) => e.isHot), [events]);
  const filtered =
    cat === "All"
      ? events
      : events.filter((e) => e.category === cat);

  return (
    <div className="max-w-[420px] mx-auto min-h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => (onClose ? onClose() : navigate(-1))}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Near You
            </h1>
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
        {hot.length > 0 && (
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
                    className="h-28 relative"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue(e.id)}, 55%, 22%), hsl(${(hue(e.id) + 120) % 360}, 45%, 13%))`,
                    }}
                  >
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
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-primary" />
                        <span className="text-xs text-primary">
                          {e.chatCount.toLocaleString()} in chat
                        </span>
                      </div>
                      {"presaleCount" in e && (
                        <span className="text-xs text-muted-foreground">
                          {e.presaleCount.toLocaleString()} presale
                        </span>
                      )}
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
          {eventsLoading ? (
            <div className="mx-4 rounded-2xl overflow-hidden bg-card/50 border border-border p-6 text-center text-muted-foreground text-sm">
              Loading events…
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
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue(e.id)}, 55%, 28%), hsl(${(hue(e.id) + 80) % 360}, 45%, 18%))`,
                    }}
                  >
                    {e.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm mb-0.5 truncate">
                      {e.name}
                    </p>
                    <p className="text-muted-foreground text-xs mb-1 truncate">
                      {e.venue} · {e.date}
                    </p>
                    <div className="flex gap-3 items-center flex-wrap">
                      <span className="text-primary text-xs font-medium">
                        ${e.priceMin}–${e.priceMax}
                      </span>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-[11px]">
                          {e.chatCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-[11px]">
                          {e.ticketsSold.toLocaleString()} sold
                        </span>
                      </div>
                      {"presaleCount" in e && (
                        <span className="text-muted-foreground text-[11px]">
                          {e.presaleCount.toLocaleString()} presale
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-muted-foreground text-xs mb-1">
                      {e.distance}
                    </p>
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
    </div>
  );
}
