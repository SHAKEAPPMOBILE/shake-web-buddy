/**
 * Ticketmaster Discovery API via Supabase Edge Function.
 * The actual API call runs in supabase/functions/fetch-events (server-side).
 */

import { supabase } from "@/integrations/supabase/client";
import { SHAKE_CITIES } from "@/data/cities";
import { stripCountrySuffixFromCityName } from "@/lib/eventCityFormat";

export interface EventItem {
  id: string;
  name: string;
  date: string;
  eventStartAt?: string;
  imageUrl?: string;
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

export async function fetchTicketmasterEvents(options?: {
  latlong?: string;
  radius?: number;
  size?: number;
  city?: string | null;
}): Promise<EventItem[]> {
  const resolvedCityName = options?.city ?? null;
  const strippedForMatch = resolvedCityName ? stripCountrySuffixFromCityName(resolvedCityName) : null;

  const normalizeForMatch = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const cityQuery = strippedForMatch ? normalizeForMatch(strippedForMatch) : null;
  const cityQueryPrimary = cityQuery ? cityQuery.split(",")[0].trim() : null;

  // Resolve city coordinates from our canonical SHAKE_CITIES list.
  // This ensures we search by lat/lng (Eventbrite "near me") even if Eventbrite's internal city names don't match.
  const cityMatch =
    cityQueryPrimary &&
    (SHAKE_CITIES.find((c) => normalizeForMatch(c.name) === cityQueryPrimary) ??
      SHAKE_CITIES.find((c) => {
        const cName = normalizeForMatch(c.name);
        return cName.includes(cityQueryPrimary) || cityQueryPrimary.includes(cName);
      }));

  const resolvedLatlong =
    options?.latlong ??
    (cityMatch ? `${cityMatch.lat},${cityMatch.lng}` : undefined);

  const cityForEdge = strippedForMatch ?? resolvedCityName ?? undefined;

  console.log("[fetchTicketmasterEvents] invoking fetch-events", {
    selectedCityRaw: resolvedCityName,
    cityAfterStrip: strippedForMatch,
    citySentToEdge: cityForEdge,
    latlong: resolvedLatlong,
    matchedShakeCity: cityMatch?.name ?? null,
    radius: options?.radius ?? 50,
    size: options?.size ?? 20,
  });

  const { data, error } = await supabase.functions.invoke<{
    events?: EventItem[];
  }>("fetch-events", {
    body: {
      latlong: resolvedLatlong,
      radius: options?.radius ?? 50,
      size: options?.size ?? 20,
      city: cityForEdge,
    },
  });

  if (error) {
    console.warn("fetch-events edge function error:", error.message || error);
    return [];
  }

  if (!data || !Array.isArray(data.events)) {
    return [];
  }

  return data.events;
}
