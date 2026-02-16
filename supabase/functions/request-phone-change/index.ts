import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHONE_REGEX = /^\+\d{7,15}$/;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    if (!PHONE_REGEX.test(phone)) {
      return json(400, { error: "Invalid phone. Use E.164 format like +351912345678" });
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
      return json(500, { error: "Failed to process request" });
    }

    if ((sentLastHour ?? 0) >= 3) {
      return json(429, { error: "Too many codes requested. Please try again later.", retryAfterSeconds: 600 });
    }

    // Cooldown: 60s between sends
    const { data: latest } = await supabase
      .from("phone_change_requests")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.created_at) {
      const secondsSince = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 1000);
      if (secondsSince < 60) {
        return json(429, { error: "Please wait before requesting another code.", retryAfterSeconds: 60 - secondsSince });
      }
    }

    // Ensure phone is not used by another user
    const { data: existingPhone } = await supabase
      .from("profiles_private")
      .select("user_id")
      .eq("phone_number", phone)
      .limit(1)
      .maybeSingle();

    if (existingPhone?.user_id && existingPhone.user_id !== user.id) {
      return json(400, { error: "That phone number is already in use." });
    }

    // Send OTP via Bird Verify API
    const birdApiKey = Deno.env.get("BIRD_API_KEY");
    const birdWorkspaceId = Deno.env.get("BIRD_WORKSPACE_ID");
    const birdChannelId = Deno.env.get("BIRD_CHANNEL_ID");
    const birdTemplateId = Deno.env.get("BIRD_WHATSAPP_TEMPLATE_ID");
    const birdTemplateVersion = Deno.env.get("BIRD_WHATSAPP_TEMPLATE_VERSION");
    const birdSmsNavigatorId = Deno.env.get("BIRD_SMS_NAVIGATOR_ID");

    if (!birdApiKey || !birdWorkspaceId || !birdChannelId || !birdTemplateId || !birdTemplateVersion) {
      console.error("Bird credentials not fully configured");
      return json(500, { error: "OTP provider not configured" });
    }

    // Use SMS channel directly
    const steps: Record<string, unknown>[] = [
      { channelId: birdChannelId },
    ];

    const birdResp = await fetch(
      `https://api.bird.com/workspaces/${birdWorkspaceId}/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${birdApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: { phonenumber: phone },
          maxAttempts: 5,
          timeout: 600,
          codeLength: 6,
          steps,
        }),
      }
    );

    if (!birdResp.ok) {
      const errText = await birdResp.text();
      console.error("Bird Verify API error:", birdResp.status, errText);
      return json(502, { error: "Failed to send verification code" });
    }

    const birdData = await birdResp.json();
    const verificationId = birdData.id;

    if (!verificationId) {
      console.error("Bird response missing verification ID:", birdData);
      return json(502, { error: "Failed to send verification code" });
    }

    // Store the request for tracking (no code_hash needed since Bird handles verification)
    const { error: insertError } = await supabase.from("phone_change_requests").insert({
      user_id: user.id,
      phone_number: phone,
      code_hash: verificationId, // Store Bird verification ID in code_hash field
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verify_attempts: 0,
    });

    if (insertError) {
      console.error("Insert phone_change_requests error:", insertError);
      return json(500, { error: "Failed to create verification" });
    }

    return json(200, {
      success: true,
      verificationId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("request-phone-change error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
