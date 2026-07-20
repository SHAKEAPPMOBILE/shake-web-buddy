import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/postmark-email-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHONE_REGEX = /^\+\d{7,15}$/;
/** Simple sanity check; same row as SMS OTP in otp_verifications (phone is the account key). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ALLOWED_PURPOSES = new Set(["login", "signup", "forgot_password"]);

/** Must stay in sync with send-bird-otp: shared hourly cap per phone for all OTP channels. */
const MAX_OTP_SENDS_PER_PHONE_PER_HOUR = 18;

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
    const fromEmail =
      Deno.env.get("SHAKE_OTP_EMAIL_FROM")?.trim() || "SHAKE <noreply@shakeapp.today>";

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const email = emailRaw.toLowerCase();
    const purpose = typeof body?.purpose === "string" ? body.purpose : "login";

    if (!PHONE_REGEX.test(phone)) {
      return json(400, { error: "Invalid phone number" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return json(400, { error: "Please enter a valid email address" });
    }
    if (!ALLOWED_PURPOSES.has(purpose)) {
      return json(400, { error: "Invalid purpose" });
    }

    if (!postmarkToken) {
      console.error("send-email-fallback-otp: POSTMARK_SERVER_TOKEN not configured");
      return json(500, { error: "Email verification is not available right now. Please use SMS or try again later." });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone_number", phone)
      .gte("created_at", oneHourAgo);

    if (!countError && (count ?? 0) >= MAX_OTP_SENDS_PER_PHONE_PER_HOUR) {
      return json(429, { error: "Too many codes requested. Please try again later." });
    }

    const code = generateOTP(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const verificationId = crypto.randomUUID();

    const { error: insertError } = await admin.from("otp_verifications").insert({
      id: verificationId,
      phone_number: phone,
      code,
      purpose,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      console.error("Failed to store email OTP:", insertError);
      return json(500, { error: "Failed to send verification code" });
    }

    const { success: emailSent, error: emailError } = await sendEmail({
      from: fromEmail,
      to: [email],
      subject: "Your Shake verification code",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
          <p style="color:#333;margin:0 0 16px;">Your Shake verification code is:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em; font-family: ui-monospace, monospace; margin: 0 0 24px;">${code}</p>
          <p style="color:#666;font-size:14px;margin:0;">Valid for 10 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
      text: `Your Shake verification code is: ${code}. Valid for 10 minutes.`,
    });

    if (!emailSent) {
      console.error("Postmark error:", emailError);
      await admin.from("otp_verifications").delete().eq("id", verificationId);
      return json(502, { error: "Failed to send verification email. Please try again." });
    }

    console.log(`Email OTP sent for ${phone} → ${email}, verificationId: ${verificationId}`);

    return json(200, {
      success: true,
      verificationId,
      expiresAt,
    });
  } catch (e) {
    console.error("send-email-fallback-otp error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
