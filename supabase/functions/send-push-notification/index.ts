import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// APNs JWT (ES256) — signed with the .p8 private key from Apple Developer
// ---------------------------------------------------------------------------
async function generateAPNsJWT(
  teamId: string,
  keyId: string,
  privateKeyPem: string,
): Promise<string> {
  // Strip PEM envelope and decode base64
  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url({ alg: "ES256", kid: keyId });
  const payloadB64 = b64url({ iss: teamId, iat: now });
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${signatureB64}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ------------------------------------------------------------------
    // Auth: require a non-empty Bearer token (internal function calls only)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ") || authHeader.length <= "Bearer ".length) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Parse body
    // ------------------------------------------------------------------
    const body = await req.json() as {
      to_user_id: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    };

    const { to_user_id, title, body: notifBody, data } = body;

    if (!to_user_id || !title || !notifBody) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_user_id, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // Look up push token
    // ------------------------------------------------------------------
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("user_id", to_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("[send-push-notification] Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to look up profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pushToken = (profile as { push_token?: string | null } | null)?.push_token;

    if (!pushToken) {
      console.log("[send-push-notification] No push token for user:", to_user_id);
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "no_token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // APNs credentials from env
    // ------------------------------------------------------------------
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const privateKeyBase64 = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
    const privateKey = atob(privateKeyBase64);
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID");
    const apnsSandbox = Deno.env.get("APNS_SANDBOX") === "true";

    console.log("[send-push-notification] APNs env vars present:", {
      APNS_KEY_ID: !!apnsKeyId,
      APNS_TEAM_ID: !!apnsTeamId,
      APNS_PRIVATE_KEY: !!privateKeyBase64,
      APNS_BUNDLE_ID: !!apnsBundleId,
      APNS_SANDBOX: apnsSandbox,
    });
    console.log("[send-push-notification] Sending to device token:", pushToken);

    if (!apnsKeyId || !apnsTeamId || !privateKey || !apnsBundleId) {
      console.error("[send-push-notification] APNs env vars not configured");
      return new Response(
        JSON.stringify({ error: "APNs not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // Build APNs JWT and send notification
    // ------------------------------------------------------------------
    const jwt = await generateAPNsJWT(apnsTeamId, apnsKeyId, privateKey);

    const apnsHost = apnsSandbox
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";

    const apnsPayload = {
      aps: {
        alert: { title, body: notifBody },
        sound: "default",
        badge: 1,
      },
      ...(data ?? {}),
    };

    const apnsRes = await fetch(`${apnsHost}/3/device/${pushToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": apnsBundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(apnsPayload),
    });

    const apnsResText = await apnsRes.text();
    console.log("[send-push-notification] APNs response:", apnsRes.status, apnsResText || "(empty body — success)");

    if (!apnsRes.ok) {
      console.error("[send-push-notification] APNs error:", apnsRes.status, apnsResText);
      return new Response(
        JSON.stringify({ error: "APNs delivery failed", detail: apnsResText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[send-push-notification] Delivered to", to_user_id);

    return new Response(
      JSON.stringify({ success: true, notified: 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-push-notification] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
