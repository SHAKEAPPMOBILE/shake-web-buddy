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

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const purpose = typeof body?.purpose === "string" ? body.purpose : "auth";

    if (!PHONE_REGEX.test(phone)) {
      return json(400, { error: "Invalid phone number" });
    }

    // Rate limiting for auth OTPs
    if (purpose === "auth") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);

      // Check rate limit: max 5 OTPs per phone per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await admin
        .from("phone_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("phone_number", phone)
        .gte("created_at", oneHourAgo);

      if (!countError && (count ?? 0) >= 5) {
        return json(429, { error: "Too many codes requested. Please try again later." });
      }
    }

    // Build Bird Verify API request - use SMS channel directly
    const steps: Record<string, unknown>[] = [
      { channelId: birdChannelId },
    ];

    const verifyPayload = {
      identifier: { phonenumber: phone },
      maxAttempts: 3,
      timeout: 600,
      codeLength: 6,
      steps,
    };

    const birdResp = await fetch(
      `https://api.bird.com/workspaces/${birdWorkspaceId}/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${birdApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyPayload),
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

    console.log(`OTP sent via Bird for ${phone}, verificationId: ${verificationId}`);

    return json(200, {
      success: true,
      verificationId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("send-bird-otp error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
