/**
 * Ticketmaster Discovery API v2 – events by location.
 * Set VITE_TICKETMASTER_API_KEY in .env (never commit the key).
 */

export interface EventItem {
  id: string;
  name: string;
  date: string;
  eventStartAt?: string;
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
  /** Ticketmaster event page URL when from API */
  ticketmasterUrl?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Music: "🎵",
  Film: "🎬",
  Arts: "🎨",
  Sports: "⚽",
  Miscellaneous: "🎫",
  Default: "🎤",
};

function getCategoryAndEmoji(segmentName: string | undefined): { category: string; emoji: string } {
  const segment = (segmentName || "Miscellaneous").trim();
  const category = segment in CATEGORY_EMOJI ? segment : "Miscellaneous";
  const emoji = CATEGORY_EMOJI[category] ?? CATEGORY_EMOJI.Default;
  return { category, emoji };
}

/** Ticketmaster API event (relevant fields only). */
interface TMEvent {
  id: string;
  name?: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } };
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string } }>;
  };
  priceRanges?: Array<{ min?: number; max?: number }>;
  sales?: { totalTicketsSold?: number; presale?: { totalTicketsSold?: number } };
  classifications?: Array<{ segment?: { name?: string } }>;
}

function mapTmEventToItem(e: TMEvent, index: number): EventItem {
  const venue = e._embedded?.venues?.[0];
  const start = e.dates?.start;
  const localDate = start?.localDate ?? "";
  const localTime = start?.localTime ?? "";
  const dateTime = start?.dateTime;
  const dateStr = [localDate, localTime].filter(Boolean).join(", ") || "TBD";
  const { category, emoji } = getCategoryAndEmoji(e.classifications?.[0]?.segment?.name);
  const priceMin = e.priceRanges?.[0]?.min ?? 0;
  const priceMax = e.priceRanges?.[0]?.max ?? 0;
  const ticketsSold = e.sales?.totalTicketsSold ?? 0;
  const presaleCount = e.sales?.presale?.totalTicketsSold;

  return {
    id: e.id,
    name: e.name ?? "Unnamed Event",
    date: dateStr,
    eventStartAt: dateTime ?? undefined,
    venue: venue?.name ?? "TBA",
    city: venue?.city?.name ?? "",
    distance: "—",
    priceMin,
    priceMax,
    category,
    emoji,
    chatCount: 0,
    ticketsSold,
    presaleCount,
    isHot: ticketsSold > 1000 || (presaleCount ?? 0) > 500,
    ticketmasterUrl: e.url,
  };
}

const BOGOTA_LATLONG = "4.71,-74.07";
const DEFAULT_RADIUS = 50;
const DEFAULT_SIZE = 20;

export async function fetchTicketmasterEvents(options?: {
  latlong?: string;
  radius?: number;
  size?: number;
}): Promise<EventItem[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    return [];
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: options?.latlong ?? BOGOTA_LATLONG,
    radius: String(options?.radius ?? DEFAULT_RADIUS),
    unit: "km",
    size: String(options?.size ?? DEFAULT_SIZE),
    sort: "date,asc",
  });

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn("Ticketmaster API error:", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    _embedded?: { events?: TMEvent[] };
  };
  const events = data._embedded?.events ?? [];
  return events.map((e, i) => mapTmEventToItem(e, i));
}
