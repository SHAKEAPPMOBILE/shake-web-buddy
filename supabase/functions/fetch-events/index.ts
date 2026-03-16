import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let spotifyAccessToken: string | null = null;
let spotifyTokenExpiresAt: number | null = null;

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

/** Row from public.public_events */
interface PublicEventRow {
  id: string;
  name: string | null;
  image_url: string | null;
  venue: string | null;
  city: string | null;
  event_starts_at: string | null;
  ticket_url: string | null;
  source: string | null;
  created_at: string | null;
}

/** Event shape returned to the frontend */
interface EventItem {
  id: string;
  name: string;
  date: string;
  eventStartAt: string | undefined;
  imageUrl: string | undefined;
  venue: string;
  city: string;
  distance: string;
  priceMin: number;
  priceMax: number;
  category: string;
  emoji: string;
  chatCount: number;
  ticketsSold: number;
  presaleCount?: number;
  isHot: boolean;
  ticketmasterUrl: string | undefined;
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
  return { category: "Music", emoji: CATEGORY_EMOJI.Music };
}

async function getSpotifyAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (spotifyAccessToken && spotifyTokenExpiresAt && now < spotifyTokenExpiresAt) {
    return spotifyAccessToken;
  }

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.warn("[fetch-events] Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
    return null;
  }

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[fetch-events] Spotify token request failed:", res.status, text);
      return null;
    }

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.warn("[fetch-events] Spotify token response missing access_token");
      return null;
    }

    spotifyAccessToken = data.access_token;
    const ttlMs = (data.expires_in ?? 3600) * 1000;
    spotifyTokenExpiresAt = now + ttlMs - 60_000;
    return spotifyAccessToken;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[fetch-events] Spotify token error:", msg);
    return null;
  }
}

function extractArtistNameFromTitle(name: string | null): string | null {
  if (!name) return null;
  const part = name.split(/[-–·|]/)[0];
  if (!part) return null;
  const cleaned = part
    .replace(/\b(tour|live|concert|en vivo|festival|show|presenta|presenta su|world tour|\d{4})\b/gi, "")
    .trim();
  return cleaned.length ? cleaned : null;
}

function isRealImageUrl(url: string | null | undefined): boolean {
  if (!url || url.trim().length === 0) return false;
  const lower = url.toLowerCase();
  const bad = ["wikipedia", "wikimedia", "shopify", "imgur", "placeholder", "b0b0b0b0"];
  if (bad.some((b) => lower.includes(b))) return false;
  return true;
}

async function getSpotifyImageForArtist(artistName: string, token: string): Promise<string | null> {
  try {
    const query = `q=${encodeURIComponent(artistName)}&type=artist&limit=1`;
    const res = await fetch(`https://api.spotify.com/v1/search?${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = res.ok ? (await res.json()) as { artists?: { items?: Array<{ name?: string | null; images?: Array<{ url?: string | null }> }> } } : null;
    const firstArtist = data?.artists?.items?.[0] ?? null;
    console.log("[fetch-events] Spotify API status=" + res.status + " firstResult=" + JSON.stringify(firstArtist));
    if (!res.ok) {
      const text = await res.text();
      console.warn("[fetch-events] Spotify search failed:", res.status, text);
      return null;
    }
    const url = firstArtist?.images?.[0]?.url ?? null;
    return url && typeof url === "string" ? url : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[fetch-events] Spotify search error:", msg);
    return null;
  }
}

function formatEventDate(iso: string | null): string {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "TBD";
  }
}

function mapPublicEventToItem(row: PublicEventRow): EventItem {
  const { category, emoji } = getCategoryAndEmoji(row.source ?? undefined);
  return {
    id: row.id,
    name: row.name ?? "Unnamed Event",
    date: formatEventDate(row.event_starts_at),
    eventStartAt: row.event_starts_at ?? undefined,
    imageUrl: row.image_url ?? undefined,
    venue: row.venue ?? "—",
    city: row.city ?? "Medellín",
    distance: "—",
    priceMin: 0,
    priceMax: 0,
    category,
    emoji,
    chatCount: 0,
    ticketsSold: 0,
    isHot: false,
    ticketmasterUrl: row.ticket_url ?? undefined,
  };
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
    let cityFilter: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.city === "string") {
        const trimmed = body.city.trim();
        cityFilter = trimmed.length ? trimmed : null;
      }
    } catch {
      cityFilter = null;
    }

    // Prefer events from public_events table; fall back to Eventbrite then mock only if empty
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        let query = supabase
          .from("public_events")
          .select("*")
          .gte("event_starts_at", new Date().toISOString());

        if (cityFilter) {
          query = query.ilike("city", `%${cityFilter}%`);
        }

        const { data: rows, error } = await query
          .order("event_starts_at", { ascending: true, nullsFirst: false });

        if (!error && rows && rows.length > 0) {
          let enrichedRows = rows as PublicEventRow[];
          try {
            const token = await getSpotifyAccessToken();
            if (token) {
              const updated: PublicEventRow[] = [];
              for (const row of enrichedRows) {
                const originalName = row.name ?? "";
                if (isRealImageUrl(row.image_url)) {
                  console.log(`[fetch-events] event="${originalName}" | extracted=— | image=kept existing CDN`);
                  updated.push(row);
                  continue;
                }
                const artistName = extractArtistNameFromTitle(row.name);
                if (!artistName) {
                  console.log(`[fetch-events] event="${originalName}" | extracted=null | image=null (no artist)`);
                  updated.push({ ...row, image_url: null });
                  continue;
                }
                const imageUrl = await getSpotifyImageForArtist(artistName, token);
                const finalUrl = imageUrl ?? null;
                console.log(`[fetch-events] event="${originalName}" | extracted="${artistName}" | image=${finalUrl ? "found" : "null"}`);
                updated.push({
                  ...row,
                  image_url: finalUrl,
                });
              }
              enrichedRows = updated;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[fetch-events] Spotify enrichment failed:", msg);
          }

          const events = enrichedRows.map(mapPublicEventToItem);
          return new Response(JSON.stringify({ events }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[fetch-events] public_events query failed:", msg);
      }
    }

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

