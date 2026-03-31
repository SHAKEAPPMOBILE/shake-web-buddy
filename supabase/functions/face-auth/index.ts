// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://shake-web-app.netlify.app",
  "http://localhost:5173",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

function getAllowedOrigins(): string[] {
  const configured = (Deno.env.get("FACE_AUTH_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return new Response(null, { status: 403, headers: corsHeaders(origin) });
    }
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (!isAllowedOrigin(origin)) {
    return json(403, { error: "Forbidden origin" }, origin);
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, { error: "Server not configured" }, origin);
    }

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return json(400, { error: "Missing userId" }, origin);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return json(404, { error: "User not found" }, origin);
    }

    // Optional hardening: only allow users that enabled face auth.
    const { data: profile } = await admin
      .from("profiles")
      .select("face_auth_enabled, face_descriptor")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.face_descriptor || profile.face_auth_enabled !== true) {
      return json(403, { error: "Face auth is not enabled for this user" }, origin);
    }

    let emailForMagicLink = userData.user.email ?? "";
    if (!emailForMagicLink) {
      const syntheticEmail = `${userId.replace(/-/g, "")}@face-auth.internal`;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        email: syntheticEmail,
        email_confirm: true,
      });
      if (updateError) {
        console.error("Failed to attach synthetic email", updateError);
        return json(500, { error: "Failed to prepare face auth session" }, origin);
      }
      emailForMagicLink = syntheticEmail;
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: emailForMagicLink,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("Failed to generate magic link", linkError, linkData);
      return json(500, { error: "Failed to generate session" }, origin);
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: verifyData, error: verifyError } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (verifyError || !verifyData?.session) {
      console.error("Failed to verify magic link token", verifyError);
      return json(500, { error: "Failed to mint session" }, origin);
    }

    return json(
      200,
      {
        success: true,
        userId,
        session: {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
          expires_at: verifyData.session.expires_at,
          token_type: verifyData.session.token_type,
        },
      },
      origin,
    );
  } catch (error) {
    console.error("face-auth error", error);
    return json(500, { error: "Unexpected error" }, origin);
  }
});
