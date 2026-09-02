import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { extractPlanFields } from "../_shared/plan-extraction-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice-to-plan, record-then-process: the client records a short clip with
// MediaRecorder (works everywhere, including native iOS — unlike the Web
// Speech API, which isn't implemented in iOS's WKWebView) and sends it here
// as base64. This transcribes it (ElevenLabs Scribe) and extracts plan
// fields (Anthropic) in one round trip.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabase.auth.getUser(token);
    if (!authData.user?.id) throw new Error("User not authenticated");

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) throw new Error("ELEVENLABS_API_KEY is not configured");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json();
    const audioBase64: string = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
    const mimeType: string = typeof body?.mime_type === "string" && body.mime_type ? body.mime_type : "audio/webm";
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audio_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    if (audioBytes.length === 0) {
      return new Response(JSON.stringify({ error: "Empty audio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    form.append("file", new Blob([audioBytes], { type: mimeType }), `voice.${extension}`);
    form.append("model_id", "scribe_v1");

    const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey },
      body: form,
    });
    if (!sttRes.ok) {
      const errText = await sttRes.text();
      console.error("[transcribe-and-parse-plan] ElevenLabs STT error:", sttRes.status, errText);
      throw new Error(`Speech-to-text failed: ${sttRes.status}`);
    }
    const sttData = await sttRes.json();
    // Defensive: pull the transcript out from whichever shape the API
    // actually returns (documented as `text`, but guard against variants).
    const transcript: string = (
      sttData?.text ??
      sttData?.transcript ??
      sttData?.results?.[0]?.text ??
      ""
    ).toString().trim();
    if (!sttData?.text) {
      console.log("[transcribe-and-parse-plan] ElevenLabs STT response shape:", JSON.stringify(sttData).slice(0, 500));
    }

    if (!transcript) {
      return new Response(JSON.stringify({ success: true, transcript: "", fields: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = await extractPlanFields(transcript, anthropicKey);

    return new Response(JSON.stringify({ success: true, transcript, fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[transcribe-and-parse-plan] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
