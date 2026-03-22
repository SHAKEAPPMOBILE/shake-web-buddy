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

  const invokeBody = {
    latlong: resolvedLatlong,
    radius: options?.radius ?? 50,
    size: options?.size ?? 20,
    city: cityForEdge,
  };

  /** Same keys as `createClient` — Edge Functions expect `Authorization: Bearer <jwt>`; use session user JWT or anon key */
  const anonOrPublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userAccessToken = sessionData.session?.access_token;
    const authorization = userAccessToken
      ? `Bearer ${userAccessToken}`
      : anonOrPublishableKey
        ? `Bearer ${anonOrPublishableKey}`
        : undefined;

    console.log("[fetchTicketmasterEvents] supabase.functions.invoke", {
      functionId: "fetch-events",
      body: invokeBody,
      headers: {
        Authorization: authorization
          ? `${authorization.slice(0, 24)}…(redacted)`
          : "(missing — set VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)",
      },
      authMode: userAccessToken ? "user_session" : anonOrPublishableKey ? "anon_key" : "none",
    });

    const { data, error } = await supabase.functions.invoke<{
      events?: EventItem[];
      error?: string;
      details?: Record<string, unknown>;
    }>("fetch-events", {
      body: invokeBody,
      ...(authorization ? { headers: { Authorization: authorization } } : {}),
    });

    console.log("[fetchTicketmasterEvents] invoke result", {
      hasFunctionsError: Boolean(error),
      functionsError: error
        ? {
            message: error.message,
            name: error.name,
            context: (error as { context?: unknown }).context,
          }
        : null,
      dataType: data === null ? "null" : typeof data,
      dataKeys: data && typeof data === "object" ? Object.keys(data as object) : [],
      eventsIsArray: Array.isArray((data as { events?: unknown })?.events),
      eventCount: Array.isArray((data as { events?: unknown })?.events)
        ? (data as { events: unknown[] }).events.length
        : undefined,
      edgeErrorField: (data as { error?: string })?.error,
      edgeDetails: (data as { details?: unknown })?.details,
      rawDataPreview:
        data && typeof data === "object"
          ? JSON.stringify(data).slice(0, 1500) + (JSON.stringify(data).length > 1500 ? "…" : "")
          : String(data),
    });

    if (error) {
      console.error("[fetchTicketmasterEvents] Edge function returned error object:", error);
      return [];
    }

    if (!data || !Array.isArray(data.events)) {
      console.error("[fetchTicketmasterEvents] Unexpected response (missing data.events array):", data);
      return [];
    }

    if (data.events.length === 0 && data.error) {
      console.warn("[fetchTicketmasterEvents] Empty events[] with edge payload:", {
        error: data.error,
        details: data.details,
      });
    }

    return data.events;
  } catch (err) {
    console.error("[fetchTicketmasterEvents] Thrown exception:", err);
    return [];
  }
}
