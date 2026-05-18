import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Returns the ISO date string (YYYY-MM-DD) of the current or most recent Monday. */
function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, …
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysBack);
  return monday.toISOString().split("T")[0];
}

interface CityEvent {
  title: string;
  description?: string;
  venue?: string;
  address?: string;
  event_date?: string;
  event_url?: string;
}

/** Extract a JSON array from Claude's text response. */
function parseEventsFromText(text: string): CityEvent[] {
  // Try a fenced code block first, then a bare array
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Verify bearer token is present (cron/service callers pass the service role key)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Query distinct cities that have venues
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

    console.log(`Fetching events for ${cities.length} cities:`, cities);

    const weekOf = getCurrentMonday();
    const results: { city: string; eventsFound: number; error?: string }[] = [];

    for (const city of cities) {
      try {
        console.log(`Searching events for: ${city}`);

        // 2. Call Claude with web_search to find real events this week
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          tools: [{ type: "web_search_20260209", name: "web_search" }],
          messages: [
            {
              role: "user",
              content:
                `Search for real events happening in ${city} this week (concerts, parties, markets, food festivals, art shows, nightlife, sports). Return a JSON array of up to 8 events, each with: title, description, venue, address, event_date (ISO format), event_url. Only include events with specific dates and venues.`,
            },
          ],
        });

        // Extract the text block from the response
        let events: CityEvent[] = [];
        for (const block of message.content) {
          if (block.type === "text") {
            events = parseEventsFromText(block.text);
            if (events.length > 0) break;
          }
        }

        console.log(`Found ${events.length} events for ${city}`);

        if (events.length === 0) {
          results.push({ city, eventsFound: 0 });
          continue;
        }

        // 3. Upsert into city_events with week_of = current Monday
        const cityEventRows = events.map((event) => ({
          city,
          title: event.title,
          description: event.description ?? null,
          venue: event.venue ?? null,
          address: event.address ?? null,
          event_date: event.event_date ?? null,
          event_url: event.event_url ?? null,
          source: "claude_web_search",
          week_of: weekOf,
          is_active: true,
        }));

        const { error: upsertError } = await supabase
          .from("city_events")
          .upsert(cityEventRows, { onConflict: "city,title,week_of" });

        if (upsertError) {
          console.error(`Error upserting city_events for ${city}:`, upsertError);
        }

        // 4. Create user_activities group chat entry for each event
        for (const event of events) {
          if (!event.event_date) continue;

          const { error: activityError } = await supabase
            .from("user_activities")
            .insert({
              activity_type: "city_event",
              city,
              title: event.title,
              scheduled_for: event.event_date,
              is_active: true,
              is_auto_generated: true,
            });

          if (activityError) {
            // Non-fatal — log and continue
            console.error(
              `Error creating user_activity for "${event.title}" in ${city}:`,
              activityError.message,
            );
          }
        }

        results.push({ city, eventsFound: events.length });
      } catch (cityError: unknown) {
        const msg = cityError instanceof Error
          ? cityError.message
          : String(cityError);
        console.error(`Error processing city "${city}":`, msg);
        results.push({ city, eventsFound: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, weekOf, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Fatal error in fetch-city-events:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
