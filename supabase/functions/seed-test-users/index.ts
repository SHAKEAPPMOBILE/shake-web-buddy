import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Test users to create
const testUsers = [
  { phone: "+15551234567", password: "Test1234!" },
  { phone: "+15559876543", password: "Test5678!" },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for password in query params or body
    const url = new URL(req.url);
    let password = url.searchParams.get("password");

    // Also check POST body
    if (!password && req.method === "POST") {
      try {
        const body = await req.json();
        password = body.password;
      } catch {
        // Ignore JSON parse errors
      }
    }

    const adminPassword = Deno.env.get("ADMIN_SEED_PASSWORD");
    
    if (!adminPassword) {
      console.error("[SEED-USERS] ADMIN_SEED_PASSWORD not configured");
      return new Response(
        JSON.stringify({ error: "Admin password not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SEED-USERS] Password verified, creating test users...");

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: Array<{ phone: string; status: string; userId?: string; error?: string }> = [];

    for (const user of testUsers) {
      console.log(`[SEED-USERS] Processing user: ${user.phone}`);

      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.phone === user.phone.replace("+", ""));

        if (existingUser) {
          console.log(`[SEED-USERS] User ${user.phone} already exists`);
          results.push({ 
            phone: user.phone, 
            status: "already_exists", 
            userId: existingUser.id 
          });
          continue;
        }

        // Create new user with phone and password
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          phone: user.phone,
          password: user.password,
          phone_confirm: true, // Skip phone verification
          user_metadata: { name: `Test User ${user.phone.slice(-4)}` }
        });

        if (createError) {
          console.error(`[SEED-USERS] Error creating user ${user.phone}:`, createError);
          results.push({ 
            phone: user.phone, 
            status: "error", 
            error: createError.message 
          });
          continue;
        }

        if (newUser?.user) {
          console.log(`[SEED-USERS] Created user ${user.phone} with ID: ${newUser.user.id}`);
          
          // Create profile for the user
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert({
              user_id: newUser.user.id,
              name: `Test User ${user.phone.slice(-4)}`,
              avatar_url: "/src/assets/avatar-1.png"
            }, { onConflict: "user_id" });

          if (profileError) {
            console.error(`[SEED-USERS] Error creating profile:`, profileError);
          }

          // Create private profile
          const { error: privateProfileError } = await supabaseAdmin
            .from("profiles_private")
            .upsert({
              user_id: newUser.user.id,
              phone_number: user.phone,
              date_of_birth: "1990-01-01" // Default DOB for test users (makes them 36 years old)
            }, { onConflict: "user_id" });

          if (privateProfileError) {
            console.error(`[SEED-USERS] Error creating private profile:`, privateProfileError);
          }

          results.push({ 
            phone: user.phone, 
            status: "created", 
            userId: newUser.user.id 
          });
        }
      } catch (err) {
        console.error(`[SEED-USERS] Unexpected error for ${user.phone}:`, err);
        results.push({ 
          phone: user.phone, 
          status: "error", 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    console.log("[SEED-USERS] Completed:", results);

    // Return HTML for easy viewing in browser
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Users Seeded</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    h1 { color: #10b981; }
    .user { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .success { border-left: 4px solid #10b981; }
    .exists { border-left: 4px solid #f59e0b; }
    .error { border-left: 4px solid #ef4444; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>✅ Test Users Seeded</h1>
  ${results.map(r => `
    <div class="user ${r.status === 'created' ? 'success' : r.status === 'already_exists' ? 'exists' : 'error'}">
      <strong>${r.phone}</strong><br>
      Status: ${r.status}<br>
      ${r.userId ? `ID: <code>${r.userId}</code>` : ''}
      ${r.error ? `Error: ${r.error}` : ''}
    </div>
  `).join('')}
  <h2>Login Credentials:</h2>
  <ul>
    <li><code>+1 555 123 4567</code> / <code>Test1234!</code></li>
    <li><code>+1 555 987 6543</code> / <code>Test5678!</code></li>
  </ul>
</body>
</html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    });

  } catch (error) {
    console.error("[SEED-USERS] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
