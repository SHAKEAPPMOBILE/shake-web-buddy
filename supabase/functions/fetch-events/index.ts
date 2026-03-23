/**
 * Public event discovery — must be callable from the browser with the anon key.
 * If you see 401 from the app: Dashboard → Edge Functions → fetch-events → Settings
 * → turn OFF "Enforce JWT Verification", OR ensure `verify_jwt = false` in
 * `supabase/config.toml` and redeploy (`supabase functions deploy fetch-events`).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SHAKE_CITIES } from "../../../src/data/cities.ts";
import { countryCodes } from "../../../src/data/countryCodes.ts";
import {
  stripCountrySuffixFromCityName,
  toTicketmasterCityName,
} from "../../../src/lib/eventCityFormat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Full request URL with `apikey` replaced for safe logging (Supabase function logs). */
function redactTicketmasterApiKeyFromUrl(fullUrl: string): string {
  try {
    const u = new URL(fullUrl);
    if (u.searchParams.has("apikey")) {
      u.searchParams.set("apikey", "(redacted)");
    }
    return u.toString();
  } catch {
    return fullUrl.replace(/([?&])apikey=[^&]*/gi, "$1apikey=(redacted)");
  }
}

let spotifyAccessToken: string | null = null;
let spotifyTokenExpiresAt: number | null = null;

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

/** DB / legacy paths — keep stable defaults */
function getCategoryAndEmoji(_segmentName: string | undefined): { category: string; emoji: string } {
  return { category: "Music", emoji: CATEGORY_EMOJI.Music };
}

/**
 * Ticketmaster Discovery: segment.name (e.g. "Music", "Sports", "Arts & Theatre").
 * @see https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
function mapTicketmasterSegment(segmentName: string | undefined): { category: string; emoji: string } {
  const s = (segmentName ?? "").trim().toLowerCase();
  if (s === "music") return { category: "Music", emoji: "🎵" };
  if (s === "sports") return { category: "Sports", emoji: "🏆" };
  if (s === "arts & theatre" || s === "arts and theatre") return { category: "Art", emoji: "🎭" };
  if (s === "comedy") return { category: "Comedy", emoji: "😂" };
  if (s === "film") return { category: "Art", emoji: "🎬" };
  if (s === "family") return { category: "Art", emoji: "👨‍👩‍👧" };
  return { category: "Music", emoji: "🎵" };
}

function extractTicketmasterSegmentName(e: TicketmasterEvent): string | undefined {
  const fromEvent = e.classifications?.[0]?.segment?.name;
  if (typeof fromEvent === "string" && fromEvent.trim()) return fromEvent.trim();
  const fromAttraction = e._embedded?.attractions?.[0]?.classifications?.[0]?.segment?.name;
  if (typeof fromAttraction === "string" && fromAttraction.trim()) return fromAttraction.trim();
  return undefined;
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
    const res = await fetchWithTimeout(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      },
      8000,
    );

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

const FALLBACK_IMAGES: Record<string, string> = {
  "no te va gustar": "https://i.scdn.co/image/ab67616100005174d5222dc17c903bf3e236e0e3",
  "rels b": "https://i.scdn.co/image/ab67616100005174d5222dc17c903bf3e236e0e3",
  "la solar": "https://i.scdn.co/image/ab67616100005174cd251af2268da17c3d967164",
};

async function getSpotifyImageForArtist(artistName: string, token: string): Promise<string | null> {
  try {
    const query = `q=${encodeURIComponent(artistName)}&type=artist&limit=1`;
    const res = await fetchWithTimeout(
      `https://api.spotify.com/v1/search?${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      8000,
    );
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
    city: row.city ?? "—",
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

function respondWithEmpty(reason: string, details?: Record<string, unknown>): Response {
  console.warn("[fetch-events] Returning empty events:", reason, details ?? {});
  return new Response(
    JSON.stringify({
      events: [],
      error: reason,
      details,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
}

function normalizeForMatch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function resolveCityAndCountryCode(cityFilter: string | null): {
  city: string | null;
  countryCode: string | null;
} {
  if (!cityFilter) return { city: null, countryCode: null };

  const normalizedCity = normalizeForMatch(cityFilter);
  const cityObj =
    SHAKE_CITIES.find((c) => normalizeForMatch(c.name) === normalizedCity) ??
    SHAKE_CITIES.find((c) => normalizeForMatch(c.name).includes(normalizedCity) || normalizedCity.includes(normalizeForMatch(c.name)));

  const countryName = cityObj?.country ?? null;
  if (!countryName) return { city: cityObj?.name ?? cityFilter, countryCode: null };

  // Our SHAKE_CITIES "USA" value doesn't match the countryCodes "United States" name.
  const normalizedCountryName = normalizeForMatch(countryName === "USA" ? "United States" : countryName);

  const country = countryCodes.find((cc) => {
    const name = normalizeForMatch(cc.name);
    return name === normalizedCountryName || name.includes(normalizedCountryName) || normalizedCountryName.includes(name);
  });

  return { city: cityObj?.name ?? cityFilter, countryCode: country?.code ?? null };
}

interface TicketmasterEvent {
  id: string;
  name: string;
  url?: string | null;
  images?: Array<{ url?: string | null }> | null;
  dates?: { start?: { dateTime?: string | null; localDate?: string | null } | null } | null;
  classifications?: Array<{
    segment?: { name?: string | null } | null;
  }> | null;
  _embedded?: {
    venues?: Array<{
      name?: string | null;
      city?: { name?: string | null } | null;
    }> | null;
    attractions?: Array<{
      classifications?: Array<{
        segment?: { name?: string | null } | null;
      }> | null;
    }> | null;
  } | null;
}

interface TicketmasterDiscoveryResponse {
  _embedded?: { events?: TicketmasterEvent[] | null } | null;
}

function mapTicketmasterEventToItem(e: TicketmasterEvent, fallbackCity?: string | null): EventItem {
  const startAt =
    e.dates?.start?.dateTime ??
    (e.dates?.start?.localDate ? new Date(e.dates.start.localDate).toISOString() : null);

  const venueName = e._embedded?.venues?.[0]?.name ?? "—";
  const cityName = e._embedded?.venues?.[0]?.city?.name ?? fallbackCity ?? "—";
  const imageUrl = e.images?.[0]?.url ?? undefined;

  const segmentName = extractTicketmasterSegmentName(e);
  const { category, emoji } = mapTicketmasterSegment(segmentName);

  return {
    id: `tm-${e.id}`,
    name: e.name ?? "Unnamed Event",
    date: formatEventDate(startAt),
    eventStartAt: startAt ?? undefined,
    imageUrl,
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
}

/** Single Ticketmaster Discovery request; returns mapped events or [] on failure/empty. */
async function fetchTicketmasterDiscoveryOnce(
  ticketmasterKey: string,
  baseParams: { radius: string; unit: string; size: string },
  geoOrCity:
    | { kind: "geo"; latlong: string; countryCode?: string | null }
    | { kind: "city"; city: string; countryCode: string },
  displayCity: string,
): Promise<EventItem[]> {
  const tmBase = "https://app.ticketmaster.com/discovery/v2/events.json";
  const ticketmasterParams: Record<string, string> = {
    apikey: ticketmasterKey,
    ...baseParams,
  };
  if (geoOrCity.kind === "geo") {
    ticketmasterParams.latlong = geoOrCity.latlong;
    if (geoOrCity.countryCode) ticketmasterParams.countryCode = geoOrCity.countryCode;
  } else {
    ticketmasterParams.city = geoOrCity.city;
    ticketmasterParams.countryCode = geoOrCity.countryCode;
  }

  const tmUrl = `${tmBase}?${new URLSearchParams(ticketmasterParams).toString()}`;
  const logUrl = redactTicketmasterApiKeyFromUrl(tmUrl);

  console.log("[fetch-events] Ticketmaster full URL (apikey redacted):", logUrl);
  console.log("[fetch-events] Calling Ticketmaster", {
    mode: geoOrCity.kind === "geo" ? "latlong+radius" : "city+countryCode",
    url: logUrl,
  });

  try {
    const res = await fetchWithTimeout(tmUrl, {}, 10000);
    const textBody = await res.text();
    if (!res.ok) {
      console.warn("[fetch-events] Ticketmaster API error:", res.status, textBody.slice(0, 500));
      return [];
    }
    let data: TicketmasterDiscoveryResponse;
    try {
      data = JSON.parse(textBody) as TicketmasterDiscoveryResponse;
    } catch {
      console.warn("[fetch-events] Ticketmaster JSON parse failed", textBody.slice(0, 300));
      return [];
    }
    const events = data._embedded?.events ?? [];
    console.log("[fetch-events] Ticketmaster response OK", {
      embeddedEventCount: events.length,
      mode: geoOrCity.kind,
    });
    if (!events.length) {
      console.warn("[fetch-events] Ticketmaster returned 0 events (empty _embedded.events)");
      return [];
    }
    return events
      .filter((e) => Boolean(e?.id) && Boolean(e?.name))
      .map((e) => mapTicketmasterEventToItem(e, displayCity));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[fetch-events] Ticketmaster fetch failed:", msg);
    return [];
  }
}

function dedupeByEventNameKeepingEarliestStart(events: EventItem[]): EventItem[] {
  // Previous behavior deduped on name only, which collapses same-show-on-multiple-dates.
  // Unique key is now `${name}__${date}`.
  const byKey = new Map<string, EventItem>();

  for (const e of events) {
    const name = (e.name ?? "").trim().toLowerCase();
    const date = (e.date ?? "").trim().toLowerCase();
    const key = `${name}__${date}`;
    if (!name || !date) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
      continue;
    }

    const existingTs = existing.eventStartAt ? new Date(existing.eventStartAt).getTime() : Infinity;
    const nextTs = e.eventStartAt ? new Date(e.eventStartAt).getTime() : Infinity;

    // Keep the earliest start for the same (name,date) pair.
    if (nextTs < existingTs) {
      byKey.set(key, e);
    }
  }

  const deduped = Array.from(byKey.values()).sort((a, b) => {
    const aTs = a.eventStartAt ? new Date(a.eventStartAt).getTime() : Infinity;
    const bTs = b.eventStartAt ? new Date(b.eventStartAt).getTime() : Infinity;
    return aTs - bTs;
  });

  const removed = Math.max(0, events.length - deduped.length);
  console.log("[fetch-events] dedupe removed", {
    inputCount: events.length,
    outputCount: deduped.length,
    removed,
  });

  return deduped;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let cityFilter: string | null = null;
    let latlong: string | null = null;
    let radiusKm: number | null = null;
    let sizeLimit = 50;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.city === "string") {
        const trimmed = body.city.trim();
        cityFilter = trimmed.length ? trimmed : null;
      }

      if (cityFilter) {
        cityFilter = stripCountrySuffixFromCityName(cityFilter);
      }

      if (body && typeof body.latlong === "string") {
        const trimmed = body.latlong.trim();
        latlong = trimmed.length ? trimmed : null;
      }

      if (body && typeof body.radius === "number" && isFinite(body.radius)) {
        radiusKm = body.radius;
      }

      if (body && typeof body.size === "number" && isFinite(body.size)) {
        sizeLimit = Math.min(200, Math.max(1, Math.floor(body.size)));
      }
    } catch {
      cityFilter = null;
      latlong = null;
      radiusKm = null;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const { city: resolvedCityName, countryCode } = resolveCityAndCountryCode(cityFilter);
    const displayCity = resolvedCityName ?? cityFilter ?? "—";

    console.log("[fetch-events] city request", {
      cityRequested: cityFilter,
      resolvedCityName,
      hasLatlong: Boolean(latlong),
      radiusKm: radiusKm ?? 50,
    });

    // --- 1) Ticketmaster first: latlong+radius, then city+country if still 0 ---
    const ticketmasterKey = Deno.env.get("TICKETMASTER_API_KEY");
    let ticketmasterEvents: EventItem[] = [];
    let ticketmasterReason: string | null = null;

    const tmBaseParams = {
      radius: String(radiusKm ?? 50),
      unit: "km",
      size: String(sizeLimit),
    };

    if (!ticketmasterKey) {
      console.warn("[fetch-events] TICKETMASTER_API_KEY missing; skipping Ticketmaster");
      ticketmasterReason = "TICKETMASTER_API_KEY not configured";
    } else {
      const canUseGeo = Boolean(latlong);
      const canUseCity = Boolean(resolvedCityName && countryCode);

      if (canUseGeo) {
        ticketmasterEvents = await fetchTicketmasterDiscoveryOnce(
          ticketmasterKey,
          tmBaseParams,
          { kind: "geo", latlong: latlong!, countryCode },
          displayCity,
        );
        console.log("[fetch-events] Ticketmaster geo attempt", { count: ticketmasterEvents.length });
      }

      if (ticketmasterEvents.length === 0 && canUseCity) {
        const tmCity = toTicketmasterCityName(resolvedCityName!);
        ticketmasterEvents = await fetchTicketmasterDiscoveryOnce(
          ticketmasterKey,
          tmBaseParams,
          { kind: "city", city: tmCity, countryCode: countryCode! },
          displayCity,
        );
        console.log("[fetch-events] Ticketmaster city attempt (after empty geo or no geo)", {
          count: ticketmasterEvents.length,
        });
      }

      if (ticketmasterEvents.length === 0) {
        if (!canUseGeo && !canUseCity) {
          console.warn("[fetch-events] Missing latlong and city/country for Ticketmaster", {
            cityFilter,
            resolvedCityName,
            countryCode,
            latlong,
          });
          ticketmasterReason = "Missing latlong or city+countryCode for Ticketmaster";
        } else {
          ticketmasterReason = "Ticketmaster returned 0 results (geo and/or city attempts)";
        }
      }
    }

    if (ticketmasterEvents.length > 0) {
      const tmBeforeDedupe = ticketmasterEvents.length;
      const events = dedupeByEventNameKeepingEarliestStart(ticketmasterEvents);
      console.log("[fetch-events] fetch summary", {
        cityRequested: cityFilter,
        ticketmasterEventsReturned: events.length,
        ticketmasterRawBeforeDedupe: tmBeforeDedupe,
        dbFallbackUsed: false,
        dbEventsReturned: 0,
      });
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Eventbrite disabled — API was returning 404; re-enable when endpoint/key is fixed.
    // const eventbriteKey = Deno.env.get("EVENTBRITE_API_KEY");
    // ... Eventbrite search ...

    // --- 2) public_events DB only after Ticketmaster returned 0; require city filter (never return global rows) ---
    let dbEvents: EventItem[] = [];
    let dbReason: string | null = null;
    let dbFallbackUsed = false;

    if (!cityFilter) {
      console.log("[fetch-events] Skipping public_events (no cityFilter — avoids returning all cities)");
    } else if (supabaseUrl && supabaseServiceKey) {
      try {
        dbFallbackUsed = true;
        console.log("[fetch-events] Ticketmaster returned 0; DB fallback for city (strict city match)", {
          cityFilter,
        });
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: rows, error } = await supabase
          .from("public_events")
          .select("*")
          .gte("event_starts_at", new Date().toISOString())
          .ilike("city", cityFilter)
          .order("event_starts_at", { ascending: true, nullsFirst: false });

        if (error) {
          console.warn("[fetch-events] public_events query error:", error.message);
          dbReason = error.message;
        } else if (rows && rows.length > 0) {
          console.log("[fetch-events] public_events returned rows", {
            count: rows.length,
            cityFilter,
          });
          const byName = new Map<string, PublicEventRow>();
          for (const row of rows as PublicEventRow[]) {
            const name = (row.name ?? "").trim();
            if (!name || byName.has(name)) continue;
            byName.set(name, row);
          }
          let enrichedRows = Array.from(byName.values());
          try {
            const token = await getSpotifyAccessToken();
            if (token) {
              const updated: PublicEventRow[] = [];
              const MAX_SPOTIFY_ENRICHMENTS = 8;
              let spotifyEnrichmentCount = 0;
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
                if (spotifyEnrichmentCount >= MAX_SPOTIFY_ENRICHMENTS) {
                  updated.push({ ...row, image_url: null });
                  continue;
                }
                const imageUrl = await getSpotifyImageForArtist(artistName, token);
                const finalUrl = imageUrl ?? null;
                console.log(`[fetch-events] event="${originalName}" | extracted="${artistName}" | image=${finalUrl ? "found" : "null"}`);
                spotifyEnrichmentCount += 1;
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

          enrichedRows = enrichedRows.map((row) => {
            if (isRealImageUrl(row.image_url)) return row;
            const artistKey = extractArtistNameFromTitle(row.name)?.toLowerCase();
            const fallback = artistKey ? FALLBACK_IMAGES[artistKey] : null;
            return fallback ? { ...row, image_url: fallback } : row;
          });

          dbEvents = enrichedRows.map(mapPublicEventToItem);
        } else {
          console.log("[fetch-events] public_events returned 0 rows for city", { cityFilter });
          dbReason = "public_events returned 0 rows";
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[fetch-events] public_events query failed:", msg);
        dbReason = msg;
      }
    } else {
      console.log("[fetch-events] Skipping public_events; missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    console.log("[fetch-events] fetch summary", {
      cityRequested: cityFilter,
      ticketmasterEventsReturned: 0,
      dbFallbackUsed,
      dbEventsReturned: dbEvents.length,
    });

    const combined = dedupeByEventNameKeepingEarliestStart([...dbEvents]);

    if (!combined.length) {
      return respondWithEmpty("No events found from Ticketmaster or public_events", {
        cityFilter,
        latlong,
        radiusKm,
        ticketmasterReason,
        dbReason,
        dbFallbackUsed,
        ticketmasterEventsReturned: 0,
        dbEventsReturned: 0,
      });
    }

    return new Response(JSON.stringify({ events: combined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[fetch-events] ERROR", message);
    return respondWithEmpty("Internal error", { message });
  }
});

