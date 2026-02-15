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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const birdApiKey = Deno.env.get("BIRD_API_KEY");
    const birdWorkspaceId = Deno.env.get("BIRD_WORKSPACE_ID");

    if (!birdApiKey || !birdWorkspaceId) {
      console.error("Bird credentials not configured");
      return json(500, { error: "OTP provider not configured" });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const verificationId = typeof body?.verificationId === "string" ? body.verificationId.trim() : "";

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

    // Mark the phone_change_request as verified
    const { error: markError } = await admin
      .from("phone_change_requests")
      .update({ verified_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("phone_number", phone)
      .eq("code_hash", verificationId)
      .is("verified_at", null);

    if (markError) {
      console.error("Mark verified error:", markError);
    }

    // Update auth user phone
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
      phone,
    });

    if (authUpdateError) {
      console.error("Admin updateUserById(phone) error:", authUpdateError);
    }

    // Update profiles_private phone_number
    const { error: privateUpdateError } = await admin
      .from("profiles_private")
      .update({ phone_number: phone })
      .eq("user_id", user.id);

    if (privateUpdateError) {
      console.error("profiles_private update error:", privateUpdateError);
      return json(500, { error: "Failed to update profile" });
    }

    return json(200, { success: true, phone });
  } catch (e) {
    console.error("verify-phone-change error:", e);
    return json(500, { error: "Unexpected error" });
  }
});
