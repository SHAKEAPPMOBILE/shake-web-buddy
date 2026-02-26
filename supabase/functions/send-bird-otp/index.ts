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

function generateOTP(length = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const infobipApiKey = Deno.env.get("INFOBIP_API_KEY");
    const infobipBaseUrl = Deno.env.get("INFOBIP_BASE_URL");
    const infobipFrom = Deno.env.get("INFOBIP_FROM");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!infobipApiKey || !infobipBaseUrl || !infobipFrom) {
      console.error("Infobip credentials not configured");
      return json(500, { error: "OTP provider not configured" });
    }

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const purpose = typeof body?.purpose === "string" ? body.purpose : "auth";

    if (!PHONE_REGEX.test(phone)) {
      return json(400, { error: "Invalid phone number" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("phone_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("phone_number", phone)
      .gte("created_at", oneHourAgo);

    if (!countError && (count ?? 0) >= 5) {
      return json(429, { error: "Too many codes requested. Please try again later." });
    }

    const code = generateOTP(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const verificationId = crypto.randomUUID();

    const { error: insertError } = await admin
      .from("otp_verifications")
      .insert({
        id: verificationId,
        phone_number: phone,
        code,
        purpose,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return json(500, { error: "Failed to send verification code" });
    }

    const smsPayload = {
      messages: [
        {
          from: infobipFrom,
          destinations: [{ to: phone }],
          text: `Your Shake verification code is: ${code}. Valid for 10 minutes.`,
        },
      ],
    };

    const infobipResp = await fetch(
      `${infobipBaseUrl}/sms/2/text/advanced`,
      {
        method: "POST",
        headers: {
          Authorization: `App ${infobipApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(smsPayload),
      }
    );

    if (!infobipResp.ok) {
      const errText = await infobipResp.text();
      console.error("Infobip SMS error:", infobipResp.status, errText);
      await admin.from("otp_verifications").delete().eq("id", verificationId);
      return json(502, { error: "Failed to send verification code" });
    }

    console.log(`OTP sent via Infobip for ${phone}, verificationId: ${verificationId}`);

    return json(200, {
      success: true,
      verificationId,
      expiresAt,
    });
  } catch (e) {
    console.error("send-bird-otp error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
