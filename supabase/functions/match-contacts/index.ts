import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MATCH-CONTACTS] ${step}${detailsStr}`);
};

// Must exactly mirror the client's normalization (see src/lib/contactMatching.ts)
// so hashes line up. Email: trim + lowercase. Phone: digits only (no "+",
// spaces, dashes, parens) — matches how Supabase stores auth.users.phone.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const requester = authData.user;
    if (!requester?.id) throw new Error("User not authenticated");

    const body = await req.json();
    const hashes: string[] = Array.isArray(body?.hashes) ? body.hashes : [];
    if (hashes.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const hashSet = new Set(hashes.map((h) => String(h).toLowerCase()));
    logStep("Processing request", { requesterId: requester.id, hashCount: hashSet.size });

    // Pull every registered user's email/phone and hash them server-side —
    // the client never learns anything about non-matching users, and we
    // never store or log anyone's raw contact list.
    const matchedUserIds = new Set<string>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: pageData, error: listError } = await supabaseClient.auth.admin.listUsers({ page, perPage });
      if (listError) throw listError;
      const users = pageData?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u.id === requester.id) continue;
        if (u.email) {
          const h = await sha256Hex(u.email.trim().toLowerCase());
          if (hashSet.has(h)) matchedUserIds.add(u.id);
        }
        if (u.phone) {
          const digitsOnly = u.phone.replace(/\D/g, "");
          const h = await sha256Hex(digitsOnly);
          if (hashSet.has(h)) matchedUserIds.add(u.id);
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }

    // Also check profiles_private.phone — a plain, unverified phone number
    // users can add for matching purposes, separate from auth.users.phone
    // (which requires OTP verification and many users never set).
    const { data: privatePhones } = await supabaseClient
      .from("profiles_private")
      .select("user_id, phone")
      .not("phone", "is", null);
    for (const row of privatePhones ?? []) {
      if (row.user_id === requester.id || !row.phone) continue;
      const digitsOnly = String(row.phone).replace(/\D/g, "");
      if (!digitsOnly) continue;
      const h = await sha256Hex(digitsOnly);
      if (hashSet.has(h)) matchedUserIds.add(row.user_id);
    }

    logStep("Matched users", { count: matchedUserIds.size });

    if (matchedUserIds.size === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const matchedIds = Array.from(matchedUserIds);

    const [{ data: profiles }, { data: friendships }] = await Promise.all([
      supabaseClient.from("profiles").select("user_id, name, avatar_url").in("user_id", matchedIds),
      supabaseClient
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${requester.id},addressee_id.eq.${requester.id}`)
        .in("requester_id", [requester.id, ...matchedIds])
        .in("addressee_id", [requester.id, ...matchedIds]),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const friendshipMap = new Map<string, { id: string; status: string; direction: "sent" | "received" }>();
    (friendships ?? []).forEach((f: any) => {
      const otherId = f.requester_id === requester.id ? f.addressee_id : f.requester_id;
      if (!matchedUserIds.has(otherId)) return;
      friendshipMap.set(otherId, {
        id: f.id,
        status: f.status,
        direction: f.requester_id === requester.id ? "sent" : "received",
      });
    });

    const matches = matchedIds.map((userId) => {
      const profile = profileMap.get(userId);
      const friendship = friendshipMap.get(userId);
      return {
        user_id: userId,
        name: profile?.name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        friendship_status: friendship?.status ?? null,
        friendship_direction: friendship?.direction ?? null,
        friendship_id: friendship?.id ?? null,
      };
    });

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
