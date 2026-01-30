import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed admin emails for password recovery
const ALLOWED_ADMIN_EMAILS = [
  "leoneltelesmeneses@gmail.com",
  "contact@shakeapp.today"
];

// Store OTPs in memory (they expire after 10 minutes)
const otpStore: Map<string, { code: string; expiresAt: number }> = new Map();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, email, otp } = body;

    // Action: send-otp - Send OTP to admin email
    if (action === "send-otp") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if email is in allowed list
      if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
        console.log(`[ADMIN-OTP] Unauthorized email attempt: ${normalizedEmail}`);
        return new Response(
          JSON.stringify({ error: "This email is not authorized for admin access" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate OTP
      const code = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP
      otpStore.set(normalizedEmail, { code, expiresAt });

      // Send OTP via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("[ADMIN-OTP] RESEND_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "Email service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resend = new Resend(resendApiKey);

      const { error: emailError } = await resend.emails.send({
        from: "SHAKE Admin <noreply@shakeapp.today>",
        to: [normalizedEmail],
        subject: "🔐 SHAKE Admin - Your Recovery Code",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #667eea; margin: 0;">SHAKE Admin</h1>
              <p style="color: #666; margin-top: 10px;">Password Recovery</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
              <p style="color: rgba(255,255,255,0.8); margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
              <div style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; font-family: monospace;">
                ${code}
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
      });

      if (emailError) {
        console.error("[ADMIN-OTP] Failed to send email:", emailError);
        return new Response(
          JSON.stringify({ error: "Failed to send verification email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[ADMIN-OTP] OTP sent to ${normalizedEmail}`);

      return new Response(
        JSON.stringify({ success: true, message: "Verification code sent to your email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: verify-otp - Verify OTP and return admin password
    if (action === "verify-otp") {
      if (!email || !otp) {
        return new Response(
          JSON.stringify({ error: "Email and OTP are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const storedOtp = otpStore.get(normalizedEmail);

      if (!storedOtp) {
        return new Response(
          JSON.stringify({ error: "No verification code found. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (Date.now() > storedOtp.expiresAt) {
        otpStore.delete(normalizedEmail);
        return new Response(
          JSON.stringify({ error: "Verification code expired. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (storedOtp.code !== otp.trim()) {
        return new Response(
          JSON.stringify({ error: "Invalid verification code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // OTP verified - clear it
      otpStore.delete(normalizedEmail);

      // Return the admin password
      const adminPassword = Deno.env.get("ADMIN_SEED_PASSWORD");

      console.log(`[ADMIN-OTP] OTP verified for ${normalizedEmail}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          password: adminPassword,
          message: "Verified! Here's your admin password." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[ADMIN-OTP] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
