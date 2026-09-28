import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Blocks sexual and violent content in user-uploaded plan videos/photos and
// chat media before it's ever stored or shown to anyone else. Called from the
// client with one or more still frames (video: a few sampled timestamps;
// image: the image itself) as base64 JPEGs — never the raw video file, which
// keeps this fast and avoids sending large uploads through an extra hop.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a content-safety classifier for a social app where members upload short video/photo previews for meetup plans, and photos/videos/videos in chat. Look at the provided image(s) — sampled frames from one upload — and decide if they contain:
- sexual content: nudity, genitals, sexual acts, or content whose clear intent is sexual/pornographic.
- graphic violence: real gore, serious injury, weapons used to threaten/harm, or content whose clear intent is to shock with violence.
Ordinary life — people eating, dancing, at the beach in swimwear, sports, a kitchen knife being used to cook, a Halloween costume, a boxing match — is NOT a violation. Be reasonably permissive: only flag clear, unambiguous violations, since real members' ordinary plan videos must never be wrongly blocked.
Respond with ONLY a JSON object, no other text: {"violation": true|false, "category": "sexual"|"violence"|"none", "reason": "one short sentence"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const images: string[] = Array.isArray(body?.images) ? body.images.filter((s: unknown) => typeof s === "string" && s.length > 0) : [];
    if (images.length === 0) {
      return new Response(JSON.stringify({ error: "images (base64 array) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Sanity cap — a handful of sampled frames is plenty; never let a caller
    // balloon this into a huge/expensive request.
    const capped = images.slice(0, 6);

    const content = [
      { type: "text", text: "Classify these sampled frames from one upload:" },
      ...capped.map((b64) => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      })),
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[moderate-media] Anthropic API error:", response.status, errText);
      // Fail OPEN on our own API/network trouble — a moderation outage must
      // never silently block every legitimate upload in the app.
      return new Response(JSON.stringify({ violation: false, category: "none", reason: "moderation unavailable", failedOpen: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(" ").trim();

    let parsed: { violation?: boolean; category?: string; reason?: string } = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : text);
    } catch (err) {
      console.error("[moderate-media] Failed to parse model output:", text, err);
      return new Response(JSON.stringify({ violation: false, category: "none", reason: "moderation unavailable", failedOpen: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        violation: parsed.violation === true,
        category: parsed.category === "sexual" || parsed.category === "violence" ? parsed.category : "none",
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[moderate-media] Unhandled error:", message);
    // Fail open here too — an unexpected server error shouldn't take upload
    // functionality down app-wide.
    return new Response(JSON.stringify({ violation: false, category: "none", reason: "moderation unavailable", failedOpen: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
