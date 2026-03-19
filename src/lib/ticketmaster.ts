/**
 * Ticketmaster Discovery API via Supabase Edge Function.
 * The actual API call runs in supabase/functions/fetch-events (server-side).
 */

import { supabase } from "@/integrations/supabase/client";
import { SHAKE_CITIES } from "@/data/cities";

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
  const cityMatch =
    resolvedCityName &&
    SHAKE_CITIES.find((c) => c.name.toLowerCase() === resolvedCityName.toLowerCase());

  const resolvedLatlong =
    options?.latlong ??
    (cityMatch ? `${cityMatch.lat},${cityMatch.lng}` : undefined);

  const { data, error } = await supabase.functions.invoke<{
    events?: EventItem[];
  }>("fetch-events", {
    body: {
      latlong: resolvedLatlong,
      radius: options?.radius ?? 50,
      size: options?.size ?? 20,
      city: options?.city ?? undefined,
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
