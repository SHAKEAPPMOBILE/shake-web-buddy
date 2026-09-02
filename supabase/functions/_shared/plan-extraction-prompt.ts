// Mirrors the wizard's own field set in src/pages/ProposePlanPage.tsx.
export const ACTIVITY_TYPE_IDS = ["dinner", "drinks", "brunch"];

export const PLAN_EXTRACTION_SYSTEM_PROMPT = `You extract structured plan details from a short spoken description someone gave while creating an event on a social app called SHAKE. Return ONLY a JSON object, no prose, matching this exact shape:

{
  "activity_type": string | null,       // one of ${JSON.stringify(ACTIVITY_TYPE_IDS)} if it clearly matches, else null (a custom/other plan is fine — leave null, the title still captures it)
  "note": string | null,                // a short punchy title for the plan, <= 60 chars, in the speaker's own words/tone
  "city": string | null,                // city name only, if mentioned
  "date_hint": string | null,           // speaker's own words for when, e.g. "this saturday", "tomorrow", "next friday", "september 5th" — do not resolve to a calendar date yourself
  "time_hint": string | null,           // speaker's own words for time, e.g. "8pm", "around 7", "noon"
  "venue_name": string | null,          // place name if mentioned
  "price_amount": string | null,        // just the number if a price was mentioned, e.g. "10" for "$10 cover"
  "capacity": number | null,            // max people, if a limit was mentioned
  "audience": "everyone" | "women_only" | "friends_only" | null,
  "description": string | null         // any extra agenda/detail beyond the title worth keeping, else null
}

Only fill a field if it was actually said or very strongly implied — never invent details. If nothing usable was said at all, return all nulls.`;

/** Calls Anthropic to turn a transcript into the structured field set above. */
export async function extractPlanFields(transcript: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: PLAN_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[plan-extraction-prompt] Anthropic error:", res.status, errText);
    throw new Error(`Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const rawText: string = data?.content?.[0]?.text ?? "{}";
  // The model is instructed to return raw JSON, but strip code fences defensively.
  const cleaned = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("[plan-extraction-prompt] Failed to parse model output:", cleaned);
    throw new Error("Couldn't parse the plan from what was said");
  }
}
