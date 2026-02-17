import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHONE_REGEX = /^\+\d{7,15}$/;
const CODE_REGEX = /^\d{6}$/;

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

    if (!birdApiKey || !birdWorkspaceId) {
      console.error("Bird credentials not configured");
      return json(500, { error: "OTP provider not configured" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const verificationId = typeof body?.verificationId === "string" ? body.verificationId.trim() : "";
    const purpose = typeof body?.purpose === "string" ? body.purpose : "login";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!PHONE_REGEX.test(phone)) return json(400, { error: "Invalid phone" });
    if (!CODE_REGEX.test(code)) return json(400, { error: "Invalid code" });
    if (!verificationId) return json(400, { error: "Missing verificationId" });

    // Verify the code with Bird Verify API
    const birdResp = await fetch(
      `https://api.bird.com/workspaces/${birdWorkspaceId}/verify/${verificationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${birdApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      }
    );

    if (!birdResp.ok) {
      const errText = await birdResp.text();
      console.error("Bird verify error:", birdResp.status, errText);

      if (birdResp.status === 400) {
        return json(400, { error: "Incorrect code. Please try again." });
      }
      return json(502, { error: "Verification failed" });
    }

    console.log(`Bird OTP verified for ${phone}, purpose: ${purpose}`);

    // Handle different purposes
    if (purpose === "signup") {
      if (!password || password.length < 6) {
        return json(400, { error: "Password must be at least 6 characters" });
      }

      // Check if user already exists
      const { data: existingProfile } = await admin
        .from("profiles_private")
        .select("user_id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (existingProfile) {
        return json(400, { error: "Account already exists. Please login instead." });
      }

      // Create user via admin API
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: { name, phone_number: phone },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return json(500, { error: "Failed to create account" });
      }

      return json(200, {
        success: true,
        userId: newUser.user.id,
        action: "signup_complete",
      });
    }

    if (purpose === "login") {
      // For login, we just confirm the OTP is valid.
      // The client will then call signInWithPassword.
      // But if they don't have a password (legacy users), we need to handle that.
      
      // Check if user exists
      const { data: existingProfile } = await admin
        .from("profiles_private")
        .select("user_id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (!existingProfile) {
        return json(400, { error: "No account found with this phone number" });
      }

      return json(200, {
        success: true,
        userId: existingProfile.user_id,
        action: "otp_verified",
      });
    }

    if (purpose === "forgot_password") {
      // Verify the user exists
      const { data: existingProfile } = await admin
        .from("profiles_private")
        .select("user_id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (!existingProfile) {
        return json(400, { error: "No account found with this phone number" });
      }

      // Update password if provided
      if (password && password.length >= 6) {
        const { error: updateError } = await admin.auth.admin.updateUserById(
          existingProfile.user_id,
          { password }
        );

        if (updateError) {
          console.error("Password update error:", updateError);
          return json(500, { error: "Failed to update password" });
        }

        return json(200, {
          success: true,
          userId: existingProfile.user_id,
          action: "password_reset",
        });
      }

      return json(200, {
        success: true,
        userId: existingProfile.user_id,
        action: "otp_verified",
      });
    }

    return json(400, { error: "Invalid purpose" });
  } catch (e) {
    console.error("verify-bird-otp error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
