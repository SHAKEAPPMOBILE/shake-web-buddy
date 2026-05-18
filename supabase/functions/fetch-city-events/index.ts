import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD of the most recent Monday (or today if today is Monday). */
function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, …
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysBack);
  return monday.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CityEvent {
  title: string;
  description?: string;
  venue?: string;
  address?: string;
  event_date?: string;
  event_url?: string;
  category?: string;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface ClaudeResponse {
  content: ClaudeContentBlock[];
  stop_reason: string;
}

// ---------------------------------------------------------------------------
// Similarity / dedup helpers
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation, collapse whitespace. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Character-trigram set for a string. */
function trigrams(s: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i + 2 < s.length; i++) {
    result.add(s.slice(i, i + 3));
  }
  return result;
}

/** Jaccard similarity [0, 1] using character trigrams. */
function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  const ta = trigrams(na);
  const tb = trigrams(nb);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  return intersection / (ta.size + tb.size - intersection);
}

// ---------------------------------------------------------------------------
// Claude response parsing
// ---------------------------------------------------------------------------

/** Extract a JSON array from Claude's text (handles fenced blocks & bare arrays). */
function parseEventsFromText(text: string): CityEvent[] {
  const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  const raw = fenced ? fenced[1] : text.match(/\[[\s\S]*\]/)?.[0];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Claude API call (raw fetch — no SDK)
// ---------------------------------------------------------------------------

async function callClaudeWithWebSearch(
  apiKey: string,
  city: string,
): Promise<CityEvent[]> {
  const prompt =
    `Search for real events happening in ${city} this week. Return ONLY a valid JSON array with no markdown or explanation. Each object must have: title (string), description (string), venue (string), address (string), event_date (ISO 8601 string), event_url (string), category (one of: music, sports, art, comedy, festivals, all). Only include events with specific dates and venues. Max 10 events.`;

  // deno-lint-ignore no-explicit-any
  const messages: any[] = [{ role: "user", content: prompt }];

  // Handle pause_turn: server-side tool loop hit its iteration cap — just
  // re-send with the assistant turn appended (up to MAX_CONTINUATIONS times).
  const MAX_CONTINUATIONS = 3;

  for (let attempt = 0; attempt < MAX_CONTINUATIONS; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Claude API error ${res.status}: ${errText.slice(0, 400)}`,
      );
    }

    const data = (await res.json()) as ClaudeResponse;
    console.log(
      `  Claude stop_reason=${data.stop_reason} blocks=${data.content.length}`,
    );

    if (data.stop_reason !== "pause_turn") {
      // Final response — pull the last text block
      for (let i = data.content.length - 1; i >= 0; i--) {
        const block = data.content[i];
        if (block.type === "text" && block.text) {
          return parseEventsFromText(block.text);
        }
      }
      return [];
    }

    // pause_turn — append assistant turn and continue
    messages.push({ role: "assistant", content: data.content });
  }

  console.warn(`  Claude did not reach end_turn after ${MAX_CONTINUATIONS} continuations`);
  return [];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Bearer token required (cron / manual callers pass the service role key)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Distinct cities from venues
    const { data: venueRows, error: venuesError } = await supabase
      .from("venues")
      .select("city")
      .not("city", "is", null);

    if (venuesError) throw venuesError;

    const cities: string[] = [
      ...new Set(
        (venueRows ?? []).map((v: { city: string }) => v.city).filter(Boolean),
      ),
    ];

    console.log(`Processing ${cities.length} cities:`, cities);

    const weekOf = getCurrentMonday();
    const results: {
      city: string;
      eventsFound: number;
      eventsInserted: number;
      error?: string;
    }[] = [];

    for (const city of cities) {
      try {
        console.log(`\n=== ${city} ===`);

        // 2. Call Claude with web_search
        const events = await callClaudeWithWebSearch(anthropicApiKey, city);
        console.log(`  Found ${events.length} events from Claude`);

        if (events.length === 0) {
          results.push({ city, eventsFound: 0, eventsInserted: 0 });
          continue;
        }

        // 3. Load existing events this week (for dedup)
        const { data: existingRows } = await supabase
          .from("city_events")
          .select("title, event_date")
          .eq("city", city)
          .eq("week_of", weekOf);

        const existing = (existingRows ?? []) as {
          title: string;
          event_date: string | null;
        }[];

        // 4. Dedup: skip if >80% title similarity AND same calendar date
        const newEvents = events.filter((event) => {
          const incomingDate = event.event_date
            ? new Date(event.event_date).toDateString()
            : null;

          return !existing.some((ex) => {
            const existingDate = ex.event_date
              ? new Date(ex.event_date).toDateString()
              : null;
            const sameDate = incomingDate === existingDate;
            return sameDate && titleSimilarity(event.title, ex.title) > 0.8;
          });
        });

        console.log(
          `  Inserting ${newEvents.length} new (${events.length - newEvents.length} duplicates skipped)`,
        );

        if (newEvents.length === 0) {
          results.push({
            city,
            eventsFound: events.length,
            eventsInserted: 0,
          });
          continue;
        }

        // 5. Upsert into city_events
        const rows = newEvents.map((event) => ({
          city,
          title: event.title,
          description: event.description ?? null,
          venue: event.venue ?? null,
          address: event.address ?? null,
          event_date: event.event_date ?? null,
          event_url: event.event_url ?? null,
          category: (event.category ?? "all").toLowerCase(),
          source: "claude_web_search",
          week_of: weekOf,
          is_active: true,
        }));

        const { error: upsertError } = await supabase
          .from("city_events")
          .upsert(rows, { onConflict: "city,title,week_of" });

        if (upsertError) {
          console.error(
            `  Upsert error for ${city}:`,
            upsertError.message,
          );
        }

        results.push({
          city,
          eventsFound: events.length,
          eventsInserted: newEvents.length,
        });
      } catch (cityError: unknown) {
        const msg = cityError instanceof Error
          ? cityError.message
          : String(cityError);
        console.error(`Error processing "${city}":`, msg);
        results.push({ city, eventsFound: 0, eventsInserted: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, weekOf, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Fatal error in fetch-city-events:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
