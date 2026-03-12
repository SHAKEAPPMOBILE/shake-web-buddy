import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TMEvent {
  id: string;
  name?: string;
  url?: string;
  images?: Array<{ url: string; width?: number; height?: number; ratio?: string }>;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } };
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string } }>;
  };
  priceRanges?: Array<{ min?: number; max?: number }>;
  sales?: { totalTicketsSold?: number; presale?: { totalTicketsSold?: number } };
  classifications?: Array<{ segment?: { name?: string } }>;
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

const BOGOTA_LATLONG = "4.71,-74.07";
const DEFAULT_RADIUS = 50;
const DEFAULT_SIZE = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ticketmasterKey = Deno.env.get("TICKETMASTER_API_KEY");
    if (!ticketmasterKey) {
      return new Response(JSON.stringify({ error: "TICKETMASTER_API_KEY is not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Allow optional overrides via JSON body, but safe defaults by default
    let body: { latlong?: string; radius?: number; size?: number } = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        // Ignore parse errors and just use defaults
        body = {};
      }
    }

    const params = new URLSearchParams({
      apikey: ticketmasterKey,
      latlong: body.latlong ?? BOGOTA_LATLONG,
      radius: String(body.radius ?? DEFAULT_RADIUS),
      unit: "km",
      size: String(body.size ?? DEFAULT_SIZE),
      sort: "date,asc",
    });

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.warn("Ticketmaster API error:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Ticketmaster API error", status: res.status }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        },
      );
    }

    const data = (await res.json()) as { _embedded?: { events?: TMEvent[] } };
    const events = data._embedded?.events ?? [];

    const mapped = events.map((e, index) => {
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
      const images = e.images ?? [];
      const imageUrl =
        images.find(
          (img) => img.ratio === "16_9" && (img.width ?? 0) >= 640,
        )?.url ||
        images[0]?.url ||
        undefined;

      return {
        id: e.id,
        name: e.name ?? "Unnamed Event",
        date: dateStr,
        eventStartAt: dateTime ?? undefined,
        imageUrl,
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
    });

    return new Response(JSON.stringify({ events: mapped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[fetch-events] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

