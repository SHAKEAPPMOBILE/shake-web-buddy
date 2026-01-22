import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONE_REGEX = /^\+\d{7,15}$/;
const CODE_REGEX = /^\d{6}$/;

function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data).then((buf) => {
    const bytes = new Uint8Array(buf);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!PHONE_REGEX.test(phone)) return json(400, { error: "Invalid phone" });
    if (!CODE_REGEX.test(code)) return json(400, { error: "Invalid code" });

    // Fetch latest unverified request for this phone
    const nowIso = new Date().toISOString();
    const { data: reqRow, error: reqError } = await admin
      .from("phone_change_requests")
      .select("id, code_hash, expires_at, verify_attempts, verified_at")
      .eq("user_id", user.id)
      .eq("phone_number", phone)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqError) {
      console.error("Read phone_change_requests error:", reqError);
      return json(500, { error: "Failed to verify" });
    }
    if (!reqRow) return json(400, { error: "No active verification request for that phone" });

    if (reqRow.expires_at <= nowIso) {
      return json(400, { error: "Code expired. Please request a new one." });
    }

    if ((reqRow.verify_attempts ?? 0) >= 5) {
      return json(429, { error: "Too many attempts. Please request a new code." });
    }

    const expectedHash = await sha256Hex(`${code}:${user.id}`);
    if (expectedHash !== reqRow.code_hash) {
      const { error: bumpError } = await admin
        .from("phone_change_requests")
        .update({ verify_attempts: (reqRow.verify_attempts ?? 0) + 1 })
        .eq("id", reqRow.id);

      if (bumpError) console.error("Increment verify_attempts error:", bumpError);
      return json(400, { error: "Incorrect code" });
    }

    // Mark verified
    const { error: markError } = await admin
      .from("phone_change_requests")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", reqRow.id);

    if (markError) {
      console.error("Mark verified error:", markError);
      return json(500, { error: "Failed to finalize verification" });
    }

    // Update auth user phone (admin)
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
      phone,
    });

    if (authUpdateError) {
      console.error("Admin updateUserById(phone) error:", authUpdateError);
      // Continue: keep profiles_private in sync even if auth phone update fails
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
