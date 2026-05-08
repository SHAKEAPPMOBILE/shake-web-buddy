import { useState, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityJoinedConfirmation } from "@/components/ActivityJoinedConfirmation";
import { cn } from "@/lib/utils";
import {
  type EventItem,
  fetchTicketmasterEvents,
  fetchFestivals,
  searchEvents,
} from "@/lib/ticketmaster";
import { SHAKE_CITIES } from "@/data/cities";
import { useEffect, useMemo } from "react";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { addGroupChatAccess, hasGroupChatAccess } from "@/lib/groupChatAccess";
import { buildEventChatNavigateState } from "@/lib/eventChatNavigation";
import { eventChatMembershipGrantsAccess } from "@/lib/eventChatMembership";
import { enqueuePendingEventChat } from "@/lib/pendingEventChat";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { EventGroupChatBanner3D } from "@/components/EventGroupChatBanner3D";

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
const FESTIVAL_TAB = "Festivals 🎪";

/** Ticketmaster segment maps to `EventItem.category` (e.g. "Music", "Sports"). */
function isMusicEventCategory(category: string | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === "music";
}

const hue = (id: string) =>
  (parseInt(id.replace("tm", ""), 10) * 47) % 360;

const DEFAULT_EVENT_STARTS_AT = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function eventDateLineForConfirmation(event: EventItem): string {
  if (event.eventStartAt) {
    const d = new Date(event.eventStartAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return event.date;
}

type PublicEventRow = {
  id: string;
  name: string | null;
  image_url: string | null;
  venue: string | null;
  city: string | null;
  event_starts_at: string | null;
  ticket_url: string | null;
};

function eventItemFromPublicRow(row: PublicEventRow): EventItem {
  const start = row.event_starts_at ? new Date(row.event_starts_at) : null;
  const dateStr =
    start && !isNaN(start.getTime())
      ? start.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Date TBD";
  return {
    id: row.id,
    name: row.name ?? "Event",
    date: dateStr,
    eventStartAt: row.event_starts_at ?? undefined,
    imageUrl: row.image_url ?? undefined,
    venue: row.venue ?? "Venue TBD",
    city: row.city ?? "",
    distance: "",
    priceMin: 0,
    priceMax: 0,
    category: "Music",
    emoji: "🎵",
    chatCount: 0,
    ticketsSold: 0,
    isHot: false,
    ticketmasterUrl: row.ticket_url ?? undefined,
  };
}

function eventItemFromEventChatRow(
  row: { event_id: string; name: string; expires_at: string },
  cityFallback: string,
): EventItem {
  const exp = new Date(row.expires_at);
  const start = !isNaN(exp.getTime()) ? new Date(exp.getTime() - 12 * 60 * 60 * 1000) : null;
  const dateStr =
    start && !isNaN(start.getTime())
      ? start.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Date TBD";
  return {
    id: row.event_id,
    name: row.name,
    date: dateStr,
    eventStartAt: start?.toISOString(),
    venue: "Venue TBD",
    city: cityFallback,
    distance: "",
    priceMin: 0,
    priceMax: 0,
    category: "Music",
    emoji: "🎵",
    chatCount: 0,
    ticketsSold: 0,
    isHot: false,
  };
}

function minimalEventItemForPayment(eventId: string, cityFallback: string): EventItem {
  return {
    id: eventId,
    name: "Your event",
    date: "Date TBD",
    venue: "See event details",
    city: cityFallback,
    distance: "",
    priceMin: 0,
    priceMax: 0,
    category: "Music",
    emoji: "🎉",
    chatCount: 0,
    ticketsSold: 0,
    isHot: false,
  };
}

/** Speedrun-style banner: flowing iridescent gradient, copy left; optional 3D note on the right for music events */
function EventGroupChatEnterVisual({
  description,
  hasPaidAccess,
  isEnteringChat,
  membershipLoading,
  onClick,
  showMusicNote = false,
}: {
  description: string;
  hasPaidAccess: boolean;
  isEnteringChat: boolean;
  membershipLoading: boolean;
  onClick: () => void;
  /** When true, show the rotating note; other categories leave the right side empty */
  showMusicNote?: boolean;
}) {
  const label =
    membershipLoading ? "Loading..." : isEnteringChat ? "Connecting..." : hasPaidAccess ? "Open Group Chat" : "Enter Group Chat";

  return (
    <div className="relative w-full rounded-2xl sm:rounded-[28px] overflow-visible border border-black/5 shadow-xl mb-3 sm:mb-4 ring-1 ring-black/[0.04]">
      <style>
        {`
          @keyframes eventChatIridescentFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @media (prefers-reduced-motion: reduce) {
            .event-chat-gradient-flow {
              animation: none !important;
              background-position: 40% 50% !important;
            }
          }
        `}
      </style>

      {/* Clip iridescent layers to rounded card; content row stays overflow-visible for 3D note */}
      <div className="absolute inset-0 -z-0 overflow-hidden rounded-2xl sm:rounded-[28px] pointer-events-none">
      {/* Living gradient: large tiled bg + position drift (teal → purple → pink → amber) */}
      <div
        className="event-chat-gradient-flow absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 80% 40%, rgba(253, 230, 200, 0.55), transparent 50%),
            radial-gradient(ellipse 80% 60% at 20% 60%, rgba(45, 212, 191, 0.35), transparent 55%),
            linear-gradient(
              105deg,
              #2dd4bf 0%,
              #a78bfa 28%,
              #f0abfc 52%,
              #fda4af 68%,
              #fcd34d 82%,
              #fb923c 92%,
              #2dd4bf 100%
            )
          `,
          backgroundSize: "320% 320%",
          backgroundPosition: "0% 50%",
          animation: "eventChatIridescentFlow 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/50 via-transparent to-amber-100/30 dark:from-white/10 dark:to-transparent"
        aria-hidden
      />
      </div>

      <div className="relative z-10 flex flex-row gap-2 items-start p-3 sm:items-center sm:justify-between sm:gap-8 sm:p-6 overflow-visible">
        {/* Copy + CTA; 3D note sits on the right (compact on mobile, unchanged desktop) */}
        <div className="min-w-0 flex-1 flex flex-col items-stretch text-left">
          <h2 className="text-lg font-extrabold tracking-tight text-neutral-950 dark:text-neutral-100 mb-1 sm:text-xl sm:mb-2">
            Event Group Chat
          </h2>
          <p className="text-xs leading-snug text-neutral-800/90 dark:text-neutral-200/90 mb-3 max-w-md sm:text-sm sm:leading-relaxed sm:mb-5">
            {description}
          </p>
          <Button
            type="button"
            onClick={onClick}
            className="w-full sm:w-auto sm:self-start rounded-full font-bold uppercase tracking-wide py-2.5 px-6 h-auto text-xs sm:py-3 sm:px-8 sm:text-sm bg-neutral-950 text-white hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 border-0 shadow-lg disabled:opacity-60"
            disabled={isEnteringChat || membershipLoading}
          >
            {isEnteringChat || membershipLoading ? (
              <LoadingSpinner size="sm" className="mr-2 text-white dark:text-neutral-950" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            {label}
          </Button>
        </div>

        {showMusicNote ? <EventGroupChatBanner3D /> : null}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  onClose,
  membershipVersion = 0,
  onJoinedEvent,
  eventsEntrySource = "home",
  eventsReturnMode = "standalone_events",
}: {
  event: EventItem;
  onClose: () => void;
  /** Bumped after server creates event_chat_members so we re-check access without remounting. */
  membershipVersion?: number;
  /** After user gains membership — show confirmation; do not navigate to chat here. */
  onJoinedEvent: (event: EventItem) => void;
  /** Tab user opened Near You from (survives Stripe via sessionStorage). */
  eventsEntrySource?: "home" | "plans";
  /** So event chat can return to embedded Near You vs standalone /events (layout remount loses overlay state). */
  eventsReturnMode?: "standalone_events" | "home_near_you";
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isEnteringChat, setIsEnteringChat] = useState(false);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [hasStoredAccess, setHasStoredAccess] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const eventStartsAt = event.eventStartAt ?? DEFAULT_EVENT_STARTS_AT;

  const hasPaidAccess = hasActiveMembership || hasStoredAccess;

  useEffect(() => {
    if (!user?.id) {
      setHasStoredAccess(false);
      return;
    }
    setHasStoredAccess(hasGroupChatAccess(user.id, event.id));
  }, [event.id, user?.id, membershipVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setHasActiveMembership(false);
      setMembershipLoading(false);
      return;
    }
    setMembershipLoading(true);
    (async () => {
      if (!user?.id) {
        setHasActiveMembership(false);
        setMembershipLoading(false);
        return;
      }
      const { data: existingMember, error: memberError } = await supabase
        .from("event_chat_members")
        .select("event_id, paid_at, expires_at, event_starts_at, user_id, id, event_name, amount_cents, stripe_payment_intent_id")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (memberError) {
        setHasActiveMembership(false);
        setMembershipLoading(false);
        return;
      }
      const active = eventChatMembershipGrantsAccess(existingMember);
      setHasActiveMembership(active);
      if (active && user?.id) {
        addGroupChatAccess(user.id, event.id);
        setHasStoredAccess(true);
      }
      setMembershipLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id, user?.id, membershipVersion]);

  const handleEnterChat = async () => {
    if (isEnteringChat) return;
    if (!user?.id) {
      toast.error("Please sign in to unlock the group chat.");
      return;
    }
    try {
      setIsEnteringChat(true);
      // If already a member of this event chat, skip payment and go directly to chat
      console.log("[EventsPage] Before event_chat_members check", { eventId: event.id, userId: user.id });
      if (!user?.id) return;
      const { data: existingMember, error: memberError } = await supabase
        .from("event_chat_members")
        .select("event_id, paid_at, expires_at, event_starts_at")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[EventsPage] After event_chat_members check", { eventId: event.id, userId: user.id, existingMember, memberError: memberError?.message });

      if (memberError) {
        console.log("[EventsPage] Error checking existing event_chat_members", memberError);
      }

      if (existingMember && eventChatMembershipGrantsAccess(existingMember)) {
        if (user?.id) addGroupChatAccess(user.id, event.id);
        onJoinedEvent(event);
        return;
      }

      // Free join — no payment required
      // Check capacity and rotate venue if needed (dinner/lunch/brunch/drinks)
      const ACTIVITY_TYPES = ["dinner", "lunch", "brunch", "drinks"];
      const VENUE_TYPE_MAP: Record<string, string> = {
        dinner: "lunch_dinner",
        lunch: "lunch_dinner",
        brunch: "brunch",
        drinks: "drinks",
      };
      const MAX_CHAT_SIZE = 7;
      const activityType = (event.category ?? "").toLowerCase();

      let targetEventId = event.id;

      if (ACTIVITY_TYPES.includes(activityType)) {
        // Count current members in this event chat
        if (!user?.id) return;
        const { count: currentCount } = await supabase
          .from("event_chat_members")
          .select("event_id", { count: "exact", head: true })
          .eq("event_id", event.id);

        if ((currentCount ?? 0) >= MAX_CHAT_SIZE) {
          // Find or create a new event chat with a different venue
          const venueType = VENUE_TYPE_MAP[activityType];
          const city = event.city ?? "";

          // Get all venues for this activity type and city
          const { data: venues } = await supabase
            .from("venues")
            .select("id, name")
            .eq("venue_type", venueType)
            .eq("city", city)
            .eq("is_active", true);

          if (venues && venues.length > 0) {
            // Find venue not already used by a full chat of this activity today
            const today = new Date().toISOString().split("T")[0];
            const { data: todayChats } = await supabase
              .from("event_chats")
              .select("event_id, venue_id")
              .eq("activity_type", activityType)
              .eq("city", city)
              .gte("created_at", today);

            const todayEventIds = [...new Set((todayChats ?? []).map((c) => c.event_id).filter(Boolean))];
            let memberCountByEvent: Record<string, number> = {};

            if (todayEventIds.length > 0) {
              if (!user?.id) return;
              const { data: memberRows } = await supabase
                .from("event_chat_members")
                .select("event_id")
                .in("event_id", todayEventIds);

              memberCountByEvent = (memberRows ?? []).reduce<Record<string, number>>((acc, row) => {
                const id = row.event_id;
                acc[id] = (acc[id] ?? 0) + 1;
                return acc;
              }, {});
            }

            // Find a chat with space first
            const chatWithSpace = todayChats?.find(
              (c) => (memberCountByEvent[c.event_id] ?? 0) < MAX_CHAT_SIZE
            );

            if (chatWithSpace) {
              targetEventId = chatWithSpace.event_id;
            } else {
              // All chats full — pick next venue in rotation
              const usedVenueIds = new Set(todayChats?.map((c) => c.venue_id));
              const nextVenue = venues.find((v) => !usedVenueIds.has(v.id)) ?? venues[0];
              const newEventId = `${activityType}-${city}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-");

              await supabase.from("event_chats").insert({
                event_id: newEventId,
                name: `${event.title ?? activityType} @ ${nextVenue.name}`,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                activity_type: activityType,
                city: city,
                venue_name: nextVenue.name,
                venue_id: nextVenue.id,
              });

              targetEventId = newEventId;
            }
          }
        } else {
          // Chat has space — make sure event_chats row exists with venue info
          await supabase.from("event_chats").upsert({
            event_id: event.id,
            name: event.title ?? activityType,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            activity_type: activityType,
            city: event.city ?? "",
            venue_name: event.venue ?? "",
          }, { onConflict: "event_id", ignoreDuplicates: true });
        }
      }

      // --- Ensure event_chats row exists for this event_id before upserting into event_chat_members ---
      // 1. Check if event_chats row exists for targetEventId
      const { data: existingChat, error: chatCheckError } = await supabase
        .from("event_chats")
        .select("event_id")
        .eq("event_id", targetEventId)
        .maybeSingle();

      if (chatCheckError) {
        toast.error("Failed to check chat room. Please try again.");
        setIsEnteringChat(false);
        return;
      }

      if (!existingChat) {
        // 2. Insert into event_chats if not exists
        const chatInsertPayload: any = {
          event_id: targetEventId,
          name: event.title ?? event.name ?? "Event Chat",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        // Optionally add more fields if available
        if (event.category) chatInsertPayload.activity_type = event.category.toLowerCase();
        if (event.city) chatInsertPayload.city = event.city;
        if (event.venue) chatInsertPayload.venue_name = event.venue;
        // Insert
        const { error: chatInsertError } = await supabase.from("event_chats").insert(chatInsertPayload);
        if (chatInsertError) {
          toast.error("Failed to create chat room. Please try again.");
          setIsEnteringChat(false);
          return;
        }
      }

      // 3. Now upsert into event_chat_members as before
      const resolveUserIdForWrite = async (): Promise<string | null> => {
        if (user?.id) return user.id;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) return session.user.id;

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        return authUser?.id ?? null;
      };

      const membershipUserId = await resolveUserIdForWrite();
      if (!membershipUserId) {
        toast.error("Please sign in to unlock the group chat.");
        return;
      }

      const parsedStart = eventStartsAt ? new Date(eventStartsAt) : null;
      const hasValidStart = parsedStart && !isNaN(parsedStart.getTime());
      const membershipExpiresAt = hasValidStart
        ? new Date(parsedStart.getTime() + 12 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const eventChatMemberPayload = {
        event_id: targetEventId,
        user_id: membershipUserId,
        paid_at: new Date().toISOString(),
        expires_at: membershipExpiresAt.toISOString(),
        event_name: event.title ?? event.name,
        event_starts_at: hasValidStart ? parsedStart.toISOString() : null,
        amount_cents: 100,
      };
      console.log("[DEBUG] event_chat_members upsert payload:", eventChatMemberPayload);

      const { error: membershipUpsertError } = await supabase.from("event_chat_members").upsert(
        eventChatMemberPayload,
        { onConflict: "user_id,event_id", ignoreDuplicates: true },
      );

      // Show confirmation modal — modal's onJoinGroupChat handles navigation
      addGroupChatAccess(membershipUserId, targetEventId);
      onJoinedEvent({ ...event, id: targetEventId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("401") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authenticated")) {
        toast.error("Your session expired. Please sign in again.");
        await signOut();
        navigate("/auth", { state: { message: "Your session expired. Please sign in again." }, replace: true });
      } else {
        toast.error("Failed to join chat. Please try again.");
      }
    } finally {
      setIsEnteringChat(false);
    }
  };

  const handleOpenChat = () => {
    navigate(`/chat/event/${event.id}`, {
      state: {
        ...buildEventChatNavigateState(event),
        eventsReturn: { mode: eventsReturnMode },
      },
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-y-auto">
      {/* Hero */}
      <div className="relative w-full aspect-[2/1] sm:aspect-[16/9] bg-black overflow-hidden">
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
        <MinimalBackButton
          className="absolute top-12 left-4 z-50 shrink-0 text-white/90 hover:text-white bg-black/30 rounded-full"
          onClick={onClose}
          aria-label="Back"
        />
        {event.isHot && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            HOT 🔥
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pt-3 pb-20 sm:pt-5 sm:pb-24">
        <h1 className="text-xl font-extrabold text-foreground leading-tight mb-2 sm:text-2xl sm:mb-4">
          {event.name}
        </h1>
        <div className="space-y-1.5 mb-3 sm:space-y-2 sm:mb-4">
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
          <div className="flex items-center gap-2 mb-3 text-muted-foreground sm:mb-5">
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
            <div className="mt-1 mb-3 sm:mb-6">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm sm:text-base no-underline hover:opacity-90"
              >
                Get Tickets <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          );
        })()}

        <EventGroupChatEnterVisual
          description="Join the group to coordinate with others going to this show. Chat stays open until 12 hours after the event starts."
          hasPaidAccess={hasPaidAccess}
          isEnteringChat={isEnteringChat}
          membershipLoading={membershipLoading}
          onClick={hasPaidAccess ? handleOpenChat : handleEnterChat}
          showMusicNote={isMusicEventCategory(event.category)}
        />
        {!hasPaidAccess && !membershipLoading && (
          <p className="text-muted-foreground text-xs mt-2 text-center sm:mt-3">
            One-time fee · Chat expires 12h after event starts
          </p>
        )}
      </div>
    </div>
  );
}

const EVENTS_ENTRY_STORAGE_KEY = "eventsEntrySource";

export default function EventsPage({
  onClose,
  eventsEntrySource: eventsEntrySourceProp = "home",
}: {
  onClose?: (tab: "home" | "plans") => void;
  eventsEntrySource?: "home" | "plans";
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isStandaloneEventsRoute = location.pathname === "/events";
  const standaloneListFetchKey = isStandaloneEventsRoute ? location.key : "";
  const [searchParams, setSearchParams] = useSearchParams();
  const joiningEventChatRef = useRef(false);
  const paymentReturnHandledRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [cat, setCat] = useState("Music");
  const [festivalEvents, setFestivalEvents] = useState<EventItem[]>([]);
  const [festivalsLoading, setFestivalsLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EventItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search when user clicks outside the search bar
  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [joinConfirmationEvent, setJoinConfirmationEvent] = useState<EventItem | null>(null);
  const [chatMembershipVersion, setChatMembershipVersion] = useState(0);

  const { user } = useAuth();
  const { selectedCity, isLoading: isCityLoading, isCityOutOfRange, isManuallySelected } = useCity();

  const chatUnlockedId = searchParams.get("chat_unlocked") || searchParams.get("event_id");
  const paymentSuccess = searchParams.get("payment_success") === "true";
  const paymentCancelled = searchParams.get("payment_cancelled") === "true";

  const resolveEventsBackTab = useCallback((): "home" | "plans" => {
    let fromStorage: "home" | "plans" | null = null;
    try {
      const raw = sessionStorage.getItem(EVENTS_ENTRY_STORAGE_KEY);
      if (raw === "plans" || raw === "home") fromStorage = raw;
    } catch {
      /* ignore */
    }
    const tab = fromStorage ?? eventsEntrySourceProp ?? "home";
    return tab === "plans" ? "plans" : "home";
  }, [eventsEntrySourceProp]);

  const handleEventsBack = useCallback(() => {
    const tab = resolveEventsBackTab();
    try {
      sessionStorage.removeItem(EVENTS_ENTRY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (onClose) {
      onClose(tab);
      return;
    }
    navigate("/", { replace: true, state: { activeTab: tab } });
  }, [onClose, navigate, resolveEventsBackTab]);

  useEffect(() => {
    if (!paymentCancelled) return;
    toast.info("Payment cancelled");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("payment_cancelled");
        return next;
      },
      { replace: true },
    );
  }, [paymentCancelled, setSearchParams]);

  /** Deep link: ?event_id=… without payment — open detail when list contains the event */
  useEffect(() => {
    if (!chatUnlockedId || paymentSuccess || !user) return;
    if (eventsLoading || events.length === 0) return;
    const ev = events.find((e) => e.id === chatUnlockedId);
    if (!ev) return;
    setSelected(ev);
  }, [chatUnlockedId, paymentSuccess, user, eventsLoading, events]);

  /**
   * Stripe returns to /events?payment_success=true&event_id=…
   * Resolve the event from the list, public_events, event_chats, or a minimal placeholder.
   * Never navigate away before showing ActivityJoinedConfirmation; clear params only after the modal is armed.
   */
  useEffect(() => {
    if (!chatUnlockedId || !paymentSuccess || !user?.id) return;

    const dedupeKey = `${user.id}:${chatUnlockedId}`;
    if (paymentReturnHandledRef.current === dedupeKey) return;

    let cancelled = false;

    const run = async () => {
      let resolved: EventItem | null = events.find((e) => e.id === chatUnlockedId) ?? null;

      if (!resolved) {
        const { data: pub } = await supabase.from("public_events").select("*").eq("id", chatUnlockedId).maybeSingle();
        if (!cancelled && pub) {
          resolved = eventItemFromPublicRow(pub as PublicEventRow);
        }
      }

      if (!resolved) {
        const { data: chat } = await supabase
          .from("event_chats")
          .select("event_id, name, expires_at")
          .eq("event_id", chatUnlockedId)
          .maybeSingle();
        if (!cancelled && chat) {
          resolved = eventItemFromEventChatRow(chat, selectedCity ?? "");
        }
      }

      if (!resolved && eventsLoading) {
        return;
      }
      if (!resolved) {
        resolved = minimalEventItemForPayment(chatUnlockedId, selectedCity ?? "");
      }

      if (cancelled) return;

      const start = resolved.eventStartAt ? new Date(resolved.eventStartAt) : new Date();
      const expiresAt = new Date(
        (isNaN(start.getTime()) ? Date.now() : start.getTime()) + 12 * 60 * 60 * 1000,
      );

      try {
        const { error: eventChatsUpsertError } = await supabase.from("event_chats").upsert(
          {
            event_id: chatUnlockedId,
            name: resolved.name,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: "event_id" },
        );
        if (eventChatsUpsertError) {
          console.warn("[EventsPage] event_chats upsert after payment redirect", eventChatsUpsertError);
        }

        const paidAt = new Date();
        const expiresAtFromStart = resolved.eventStartAt ? new Date(resolved.eventStartAt) : null;
        const hasValidStart = expiresAtFromStart && !isNaN(expiresAtFromStart.getTime());
        const membershipExpiresAt = hasValidStart
          ? new Date(expiresAtFromStart.getTime() + 12 * 60 * 60 * 1000)
          : new Date(paidAt.getTime() + 24 * 60 * 60 * 1000);

        let membershipUserId = user?.id ?? null;
        if (!membershipUserId) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          membershipUserId = session?.user?.id ?? null;
        }
        if (!membershipUserId) {
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          membershipUserId = authUser?.id ?? null;
        }
        if (!membershipUserId) {
          console.warn("[EventsPage] Skipping membership upsert after payment: no authenticated user id");
          return;
        }

        const { error: membershipUpsertError } = await supabase.from("event_chat_members").upsert(
          {
            event_id: chatUnlockedId,
            user_id: membershipUserId,
            joined_at: new Date().toISOString(),
            paid_at: paidAt.toISOString(),
            expires_at: membershipExpiresAt.toISOString(),
            event_name: resolved.name,
            event_starts_at: resolved.eventStartAt ?? null,
            amount_cents: 100,
          },
          { onConflict: "user_id,event_id", ignoreDuplicates: true },
        );
        // always navigate even if upsert error (member may already exist)
    if (false && membershipUpsertError) {
          console.warn("[EventsPage] event_chat_members upsert after payment (webhook may have succeeded)", membershipUpsertError);
        }
        // Always navigate to the group chat, even if upsert error (unless user id missing)
        addGroupChatAccess(user.id, chatUnlockedId);
        setSelected(null);
        setJoinConfirmationEvent(resolved);
        // Modal handles navigation via onJoinGroupChat
      } catch (error) {
        console.warn("[EventsPage] membership upsert after payment redirect", error);
      }

      if (cancelled) return;

      paymentReturnHandledRef.current = dedupeKey;
      setChatMembershipVersion((v) => v + 1);
      addGroupChatAccess(user.id, chatUnlockedId);
      setSelected(null);
      setJoinConfirmationEvent(resolved);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("payment_success");
          next.delete("chat_unlocked");
          next.delete("event_id");
          return next;
        },
        { replace: true },
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [chatUnlockedId, paymentSuccess, user, events, eventsLoading, selectedCity, setSearchParams]);

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
  }, [
    selectedCity,
    isCityLoading,
    isCityOutOfRange,
    isManuallySelected,
    standaloneListFetchKey,
  ]);

  useEffect(() => {
    if (cat !== FESTIVAL_TAB) return;
    if (isCityLoading || !selectedCity) {
      setFestivalsLoading(true);
      return;
    }
    const normalize = (s: string) =>
      s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const cityNorm = normalize(selectedCity);
    const cityMatch =
      SHAKE_CITIES.find((c) => normalize(c.name) === cityNorm) ??
      SHAKE_CITIES.find((c) => {
        const n = normalize(c.name);
        return n.includes(cityNorm) || cityNorm.includes(n);
      });
    if (!cityMatch) {
      setFestivalsLoading(false);
      setFestivalEvents([]);
      return;
    }
    let cancelled = false;
    setFestivalsLoading(true);
    fetchFestivals(cityMatch.lat, cityMatch.lng, 200)
      .then((list) => { if (!cancelled) setFestivalEvents(list); })
      .catch(() => { if (!cancelled) setFestivalEvents([]); })
      .finally(() => { if (!cancelled) setFestivalsLoading(false); });
    return () => { cancelled = true; };
  }, [cat, selectedCity, isCityLoading]);

  /** Default to Music for each city; empty-category fallback still handled below */
  useEffect(() => {
    setCat("Music");
  }, [selectedCity]);

  useEffect(() => {
    if (events.length === 0 || cat === "All" || cat === FESTIVAL_TAB) return;
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
    cat === FESTIVAL_TAB
      ? festivalEvents
      : cat === "All"
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
    <div className="w-full h-full flex flex-col bg-white overflow-hidden relative">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <MinimalBackButton
            onClick={handleEventsBack}
            className="shrink-0 text-gray-500 hover:text-gray-900"
            aria-label="Back"
          />
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Near You
          </h1>
        </div>
        {/* Category filter pills — always visible */}
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
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:border-primary/30"
              )}
            >
              {c}
            </button>
          ))}
          <button
            key={FESTIVAL_TAB}
            type="button"
            onClick={() => setCat(FESTIVAL_TAB)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              cat === FESTIVAL_TAB
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border hover:border-primary/30"
            )}
          >
            {FESTIVAL_TAB}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-5 overflow-y-auto">
        {/* Fixed-height scrollable events container — shows ~4 rows, search results replace list when active */}
        <div
          style={{ overflowY: "auto", scrollbarWidth: "thin" }}
          className="h-[280px] rounded-2xl border border-gray-200 bg-white overflow-hidden"
        >
          {/* Search mode */}
          {searchOpen && searchQuery.length < 2 && (
            <div className="h-full flex items-center justify-center p-6">
              <p className="text-sm text-gray-400 text-center">Type to search concerts &amp; festivals...</p>
            </div>
          )}
          {searchOpen && searchQuery.length >= 2 && searchLoading && (
            <div className="p-4 space-y-3">
              <div className="animate-pulse space-y-3">
                <div className="h-14 rounded-xl bg-muted/60" />
                <div className="h-14 rounded-xl bg-muted/60" />
                <div className="h-14 rounded-xl bg-muted/60" />
              </div>
            </div>
          )}
          {searchOpen && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
            <div className="h-full flex items-center justify-center p-6">
              <p className="text-sm text-gray-400 text-center">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
          {searchOpen && searchQuery.length >= 2 && !searchLoading && searchResults.length > 0 && (
            <div className="flex flex-col">
              {searchResults.map((e, i) => (
                <div key={e.id}>
                  {i > 0 && <div className="h-px bg-gray-100 mx-4" />}
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="w-full flex items-center gap-3 py-3 px-4 bg-transparent border-0 cursor-pointer text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="overflow-hidden shrink-0 flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }}>
                      {e.imageUrl ? (
                        <img
                          src={e.imageUrl}
                          alt={e.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(ev) => {
                            const img = ev.currentTarget;
                            const parent = img.parentElement!;
                            img.remove();
                            parent.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">🎵</div>';
                          }}
                        />
                      ) : (
                        <span className="text-2xl">{e.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{e.name}</p>
                      <p className="text-gray-500 text-xs mb-0.5 truncate">{e.venue} · {e.city}</p>
                      <p className="text-gray-500 text-xs">{e.date}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Normal events list */}
          {!searchOpen && isCityOutOfRange && !isManuallySelected && (
            <div className="h-full flex items-center justify-center p-6">
              <p className="text-sm text-gray-400 text-center">SHAKE is coming to your city soon 🌍 Stay tuned!</p>
            </div>
          )}
          {!searchOpen && !(isCityOutOfRange && !isManuallySelected) && (cat === FESTIVAL_TAB ? festivalsLoading : eventsLoading) && (
            <div className="p-4 space-y-3 animate-pulse">
              <div className="h-14 rounded-xl bg-muted/60" />
              <div className="h-14 rounded-xl bg-muted/60" />
              <div className="h-14 rounded-xl bg-muted/60" />
              <div className="h-14 rounded-xl bg-muted/60" />
            </div>
          )}
          {!searchOpen && !(isCityOutOfRange && !isManuallySelected) && !(cat === FESTIVAL_TAB ? festivalsLoading : eventsLoading) && filtered.length === 0 && (
            <div className="h-full flex items-center justify-center p-6">
              <p className="text-sm text-gray-400 text-center">No events in {selectedCity ?? "this city"} yet — check back soon 🔥</p>
            </div>
          )}
          {!searchOpen && !(isCityOutOfRange && !isManuallySelected) && !(cat === FESTIVAL_TAB ? festivalsLoading : eventsLoading) && filtered.length > 0 && (
            <div className="flex flex-col">
              {filtered.map((e, i) => (
                <div key={e.id}>
                  {i > 0 && <div className="h-px bg-gray-100 mx-4" />}
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="w-full flex items-center gap-3 py-3 px-4 bg-transparent border-0 cursor-pointer text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="overflow-hidden shrink-0 flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }}>
                      {e.imageUrl ? (
                        <img
                          src={e.imageUrl}
                          alt={e.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(ev) => {
                            const img = ev.currentTarget;
                            const parent = img.parentElement!;
                            img.remove();
                            parent.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">🎵</div>';
                          }}
                        />
                      ) : (
                        <span className="text-2xl">🎵</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{e.name}</p>
                      <p className="text-gray-500 text-xs mb-0.5 truncate">{e.venue} · {e.date}</p>
                      <div className="flex gap-3 items-center flex-wrap">
                        {(e.priceMin != null && e.priceMax != null && e.priceMin > 0 && e.priceMax > 0) && (
                          <span className="text-primary text-xs font-medium">${e.priceMin}–${e.priceMax}</span>
                        )}
                        {e.ticketsSold ? (
                          <div className="flex items-center gap-1">
                            <Users className="w-2.5 h-2.5 text-gray-400" />
                            <span className="text-gray-400 text-[11px]">{e.ticketsSold.toLocaleString()} sold</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search bar — collapsed pill by default, expands to input when active */}
        {!searchOpen ? (
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setSearchQuery("");
              setSearchResults([]);
            }}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-full bg-gray-100 border border-gray-200 text-gray-500 text-sm hover:bg-gray-200 transition-colors"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span>Search events...</span>
          </button>
        ) : (
          <div ref={searchRef} className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            {searchLoading && (
              <div className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            )}
            <input
              autoFocus
              type="text"
              value={searchQuery}
              placeholder="Search concerts & festivals..."
              className="w-full pl-9 pr-9 py-3 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(e) => {
                const q = e.target.value;
                setSearchQuery(q);
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                if (q.length < 2) {
                  setSearchResults([]);
                  setSearchLoading(false);
                  return;
                }
                setSearchLoading(true);
                searchTimerRef.current = setTimeout(() => {
                  searchEvents(q)
                    .then((res) => setSearchResults(res))
                    .catch(() => setSearchResults([]))
                    .finally(() => setSearchLoading(false));
                }, 400);
              }}
            />
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <p className="text-center text-gray-400 text-[11px] px-6">
          Powered by Ticketmaster · Purchases on ticketmaster.com
        </p>
      </div>

      {selected && (
        <EventDetail
          event={selected}
          onClose={() => setSelected(null)}
          membershipVersion={chatMembershipVersion}
          eventsEntrySource={resolveEventsBackTab()}
          eventsReturnMode={isStandaloneEventsRoute ? "standalone_events" : "home_near_you"}
          onJoinedEvent={(ev) => {
            setSelected(null);
            setJoinConfirmationEvent(ev);
          }}
        />
      )}

      <ActivityJoinedConfirmation
        open={!!joinConfirmationEvent}
        onOpenChange={(open) => {
          if (!open) {
            setJoinConfirmationEvent(null);
            if (joiningEventChatRef.current) {
              joiningEventChatRef.current = false;
              return;
            }
            if (location.pathname === "/events") {
              navigate("/", { replace: true, state: { openEvents: true } });
              return;
            }
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.delete("payment_success");
                next.delete("chat_unlocked");
                next.delete("event_id");
                return next;
              },
              { replace: true },
            );
          }
        }}
        activityType="lunch"
        city={joinConfirmationEvent?.city ?? ""}
        eventConfirmation={
          joinConfirmationEvent
            ? {
                name: joinConfirmationEvent.name,
                dateLine: eventDateLineForConfirmation(joinConfirmationEvent),
                venue: joinConfirmationEvent.venue,
                city: joinConfirmationEvent.city,
                emoji: joinConfirmationEvent.emoji,
              }
            : undefined
        }
        onJoinGroupChat={() => {
          joiningEventChatRef.current = true;
          const ev = joinConfirmationEvent;
          const id = ev?.id;
          setJoinConfirmationEvent(null);
          if (id) {
            navigate(`/chat/event/${id}`, {
              replace: true,
              state: ev
                ? {
                    ...buildEventChatNavigateState(ev),
                    eventDate: ev.eventStartAt || ev.scheduled_for || null,
                    dateLine: eventDateLineForConfirmation(ev),
                    eventsReturn: {
                      mode: isStandaloneEventsRoute ? "standalone_events" : "home_near_you",
                    },
                  }
                : undefined,
            });
          }
        }}
      />
    </div>
  );
}
