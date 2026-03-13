import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EventbriteEvent {
  id: string;
  name?: { text?: string | null } | null;
  url?: string | null;
  logo?: { original?: { url?: string | null } | null; url?: string | null } | null;
  start?: { utc?: string | null } | null;
  venue?: {
    name?: string | null;
    address?: { city?: string | null } | null;
  } | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Music: "🎵",
  Film: "🎬",
  Arts: "🎨",
  Sports: "⚽",
  Miscellaneous: "🎫",
  Default: "🎤",
};

function getCategoryAndEmoji(_segmentName: string | undefined): { category: string; emoji: string } {
  // For now, treat all Eventbrite events as "Music" for UI purposes
  return { category: "Music", emoji: CATEGORY_EMOJI.Music };
}

// Safe mock events used when upstream providers are unavailable or empty
const MOCK_EVENTS = [
  {
    id: "tm-mock-1",
    name: "LCD Soundsystem",
    date: "Mar 15, 2026",
    eventStartAt: "2026-03-15T19:00:00Z",
    imageUrl: undefined,
    venue: "El Campín",
    city: "Bogotá",
    distance: "0.4 km",
    priceMin: 89,
    priceMax: 245,
    category: "Music",
    emoji: "🎵",
    chatCount: 0,
    ticketsSold: 1240,
    presaleCount: 420,
    isHot: true,
    ticketmasterUrl: "https://www.ticketmaster.com",
  },
  {
    id: "tm-mock-2",
    name: "Morat: Gira Mundial",
    date: "Mar 22, 2026",
    eventStartAt: "2026-03-22T20:00:00Z",
    imageUrl: undefined,
    venue: "Movistar Arena",
    city: "Bogotá",
    distance: "1.2 km",
    priceMin: 65,
    priceMax: 200,
    category: "Pop",
    emoji: "🎤",
    chatCount: 0,
    ticketsSold: 8500,
    presaleCount: 3100,
    isHot: true,
    ticketmasterUrl: "https://www.ticketmaster.com",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const eventbriteKey = Deno.env.get("EVENTBRITE_API_KEY");
    if (!eventbriteKey) {
      console.warn("[fetch-events] EVENTBRITE_API_KEY missing, returning mock events");
      return new Response(
        JSON.stringify({
          events: MOCK_EVENTS,
          warning: "Using mock events - EVENTBRITE_API_KEY not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const url =
      "https://www.eventbriteapi.com/v3/events/search/?" +
      new URLSearchParams({
        "location.address": "Medellin,Colombia",
        "location.within": "50km",
        expand: "venue,logo",
      }).toString();

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${eventbriteKey}`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[fetch-events] Eventbrite fetch failed:", msg);
      return new Response(
        JSON.stringify({
          events: MOCK_EVENTS,
          warning: "Using mock events - Eventbrite unavailable",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (!res.ok) {
      const text = await res.text();
      console.warn("[fetch-events] Eventbrite API error:", res.status, text);
      return new Response(
        JSON.stringify({
          events: MOCK_EVENTS,
          warning: "Using mock events - Eventbrite error",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const data = (await res.json()) as { events?: EventbriteEvent[] };
    const events = data.events ?? [];

    if (!events.length) {
      console.warn("[fetch-events] Eventbrite returned 0 events, using mock events");
      return new Response(
        JSON.stringify({
          events: MOCK_EVENTS,
          warning: "Using mock events - Eventbrite returned 0 results",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const mapped = events.map((e) => {
      const nameText = e.name?.text ?? "Unnamed Event";
      const logoUrl =
        e.logo?.original?.url ??
        e.logo?.url ??
        undefined;
      const venueName = e.venue?.name ?? "Medellín";
      const cityName = e.venue?.address?.city ?? "Medellín";
      const eventStartAt = e.start?.utc ?? undefined;

      // For now, we treat all Eventbrite results as "Music" for the UI
      const { category, emoji } = getCategoryAndEmoji(undefined);

      return {
        id: `eb-${e.id}`,
        name: nameText,
        date: eventStartAt ?? "TBD",
        eventStartAt,
        imageUrl: logoUrl,
        venue: venueName,
        city: cityName,
        distance: "—",
        priceMin: 0,
        priceMax: 0,
        category,
        emoji,
        chatCount: 0,
        ticketsSold: 0,
        presaleCount: undefined,
        isHot: false,
        ticketmasterUrl: e.url ?? undefined,
      };
    });

    return new Response(JSON.stringify({ events: mapped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[fetch-events] ERROR", message);
    return new Response(JSON.stringify({ events: MOCK_EVENTS, warning: "Using mock events - internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

