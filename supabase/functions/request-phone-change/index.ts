import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VonageSMSService } from "../_shared/vonage-sms-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONE_REGEX = /^\+\d{7,15}$/;

function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data).then((buf) => {
    const bytes = new Uint8Array(buf);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

function random6Digits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tooMany(message: string, retryAfterSeconds?: number) {
  return new Response(JSON.stringify({ error: message, retryAfterSeconds }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    if (!PHONE_REGEX.test(phone)) {
      return badRequest("Invalid phone. Use E.164 format like +351912345678");
    }

    // Rate limit: max 3 sends/hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: sentLastHour, error: countError } = await supabase
      .from("phone_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Rate limit count error:", countError);
      return new Response(JSON.stringify({ error: "Failed to process request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((sentLastHour ?? 0) >= 3) {
      return tooMany("Too many codes requested. Please try again later.", 60 * 10);
    }

    // Cooldown: 60s between sends
    const { data: latest, error: latestError } = await supabase
      .from("phone_change_requests")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Latest request read error:", latestError);
    }

    if (latest?.created_at) {
      const last = new Date(latest.created_at).getTime();
      const secondsSince = Math.floor((Date.now() - last) / 1000);
      if (secondsSince < 60) {
        return tooMany("Please wait before requesting another code.", 60 - secondsSince);
      }
    }

    // Ensure the phone is not already used by another user
    const { data: existingPhone, error: existingPhoneError } = await supabase
      .from("profiles_private")
      .select("user_id")
      .eq("phone_number", phone)
      .limit(1)
      .maybeSingle();

    if (existingPhoneError) {
      console.error("Existing phone check error:", existingPhoneError);
      return new Response(JSON.stringify({ error: "Failed to process request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (existingPhone?.user_id && existingPhone.user_id !== user.id) {
      return badRequest("That phone number is already in use.");
    }

    const code = random6Digits();
    const codeHash = await sha256Hex(`${code}:${user.id}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("phone_change_requests").insert({
      user_id: user.id,
      phone_number: phone,
      code_hash: codeHash,
      expires_at: expiresAt,
      verify_attempts: 0,
    });

    if (insertError) {
      console.error("Insert phone_change_requests error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create verification" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Initialize Vonage SMS service
    const smsService = VonageSMSService.fromEnv();

    const message = `Your Shake verification code is ${code}. It expires in 10 minutes.`;
    
    try {
      await smsService.sendSMS({ to: phone, message });
    } catch (error) {
      console.error("Vonage send failed:", error);
      return new Response(JSON.stringify({ error: "Failed to send SMS" }), { 
        status: 502, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({ success: true, expiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("request-phone-change error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
