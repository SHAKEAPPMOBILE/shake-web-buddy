import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const password = url.searchParams.get("password");
  const adminPassword = Deno.env.get("ADMIN_SEED_PASSWORD");

  if (!adminPassword) {
    return new Response("Admin password not configured", { status: 500 });
  }

  if (!password || password !== adminPassword) {
    // Show password form
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Admin Access</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      max-width: 400px;
      width: 100%;
    }
    h1 { color: #1a1a2e; margin-bottom: 8px; font-size: 24px; }
    p { color: #666; margin-bottom: 24px; font-size: 14px; }
    input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 16px;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #667eea; }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102,126,234,0.3); }
  </style>
</head>
<body>
  <div class="card" style="text-align: center;">
    <h1>🔐 Admin Access</h1>
    <p>Enter the admin password to continue</p>
    <form method="GET">
      <input type="password" name="password" placeholder="Admin Password" required autofocus>
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  // Handle POST - create a new user
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { phone, userPassword, name, isPremium } = body;

      if (!phone || !userPassword) {
        return new Response(
          JSON.stringify({ error: "Phone and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const cleanPhone = phone.replace(/\s+/g, "");
      const existingUser = existingUsers?.users?.find(
        u => u.phone === cleanPhone.replace("+", "") || u.phone === cleanPhone
      );

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "User with this phone already exists", userId: existingUser.id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new user with phone and password - phone verified!
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: cleanPhone,
        password: userPassword,
        phone_confirm: true, // Skip phone verification - user can login immediately
        user_metadata: { name: name || null, admin_password: userPassword }
      });

      if (createError) {
        console.error("[ADMIN] Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newUser?.user) {
        console.log(`[ADMIN] Created user ${cleanPhone} with ID: ${newUser.user.id}`);

        // Create minimal profile (user will complete on first login)
        await supabaseAdmin.from("profiles").upsert({
          user_id: newUser.user.id,
          name: name || null,
        }, { onConflict: "user_id" });

        // Create private profile with phone and premium status
        await supabaseAdmin.from("profiles_private").upsert({
          user_id: newUser.user.id,
          phone_number: cleanPhone,
          premium_override: isPremium || false,
        }, { onConflict: "user_id" });

        return new Response(
          JSON.stringify({ 
            success: true, 
            userId: newUser.user.id,
            phone: cleanPhone,
            message: "User created successfully! They can now login with phone + password."
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Unknown error creating user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] Error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle DELETE - delete a user
  if (req.method === "DELETE") {
    try {
      const body = await req.json();
      const { userId } = body;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "User deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Initialize admin client for GET operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Handle search action
  const action = url.searchParams.get("action");
  const query = url.searchParams.get("query");
  
  // Handle bulk password update for all users
  if (action === "set-all-passwords") {
    const defaultPassword = url.searchParams.get("defaultPassword") || "Test1234!";
    
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const users = usersData?.users || [];
    
    let updated = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        // Update user metadata with the password
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: defaultPassword,
          user_metadata: { 
            ...user.user_metadata,
            admin_password: defaultPassword 
          }
        });
        
        if (error) {
          console.error(`[ADMIN] Failed to update user ${user.id}:`, error);
          failed++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[ADMIN] Error updating user ${user.id}:`, err);
        failed++;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updated} users, ${failed} failed`,
        updated,
        failed,
        total: users.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  if (action === "search" && query) {
    const searchQuery = query.toLowerCase();
    
    // Get all users
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const users = usersData?.users || [];
    
    // Get profiles for names
    const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, name");
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    
    // Get private profiles for premium status
    const { data: privateProfiles } = await supabaseAdmin.from("profiles_private").select("user_id, premium_override");
    const privateProfileMap = new Map(privateProfiles?.map(p => [p.user_id, p]) || []);
    
    // Filter users by name or phone
    const matchedUsers = users.filter(user => {
      const profile = profileMap.get(user.id);
      const userName = (profile?.name || user.user_metadata?.name || "").toLowerCase();
      const userPhone = (user.phone || "").toLowerCase();
      return userName.includes(searchQuery) || userPhone.includes(searchQuery);
    }).map(user => {
      const profile = profileMap.get(user.id);
      const privateProfile = privateProfileMap.get(user.id);
      return {
        id: user.id,
        phone: user.phone ? (user.phone.startsWith('+') ? user.phone : '+' + user.phone) : "",
        name: profile?.name || user.user_metadata?.name || null,
        password: user.user_metadata?.admin_password || null,
        isPremium: privateProfile?.premium_override || false,
        created_at: user.created_at
      };
    });
    
    return new Response(
      JSON.stringify({ users: matchedUsers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // GET - show admin dashboard (existing code)
  // Get existing users
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  const users = usersData?.users || [];

  // Get profiles for additional info
  const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>SHAKE Admin - Test Users</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f7;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { font-size: 28px; }
    header p { opacity: 0.9; margin-top: 4px; }
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      margin-bottom: 24px;
    }
    .card h2 { color: #1a1a2e; margin-bottom: 20px; font-size: 18px; }
    .form-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .form-group { flex: 1; min-width: 200px; }
    .form-group label { display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 500; }
    input {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 15px;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #667eea; }
    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 6px 12px rgba(102,126,234,0.3); }
    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    button.danger { background: #ef4444; }
    button.danger:hover { box-shadow: 0 6px 12px rgba(239,68,68,0.3); }
    .users-list { margin-top: 12px; }
    .user-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      margin-bottom: 10px;
      transition: background 0.2s;
    }
    .user-item:hover { background: #f3f4f6; }
    .user-info { flex: 1; }
    .user-phone { font-weight: 600; color: #1a1a2e; font-size: 15px; }
    .user-meta { font-size: 13px; color: #666; margin-top: 4px; }
    .user-id { font-family: monospace; font-size: 11px; color: #999; margin-top: 2px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
    }
    .badge.verified { background: #d1fae5; color: #065f46; }
    .badge.unverified { background: #fee2e2; color: #991b1b; }
    .empty { text-align: center; padding: 40px; color: #666; }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s;
      z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: #10b981; }
    .toast.error { background: #ef4444; }
    .stats {
      display: flex;
      gap: 16px;
    }
    .stat {
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 8px;
    }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 12px; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🎯 SHAKE Admin</h1>
        <p>Create and manage test users</p>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${users.length}</div>
          <div class="stat-label">Total Users</div>
        </div>
      </div>
    </header>

    <div class="card">
      <h2>➕ Create New Test User</h2>
      <form id="createUserForm">
        <div class="form-row">
          <div class="form-group">
            <label>Phone Number (with country code)</label>
            <input type="tel" id="phone" placeholder="+1 555 123 4567" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="text" id="userPassword" placeholder="Test1234!" required>
          </div>
          <div class="form-group">
            <label>Name (optional)</label>
            <input type="text" id="name" placeholder="Test User">
          </div>
        </div>
        <button type="submit" id="createBtn">Create User</button>
      </form>
      <p style="margin-top: 16px; font-size: 13px; color: #666;">
        ✨ Users created here can login immediately with phone + password. On first login, they'll be asked to complete their profile.
      </p>
    </div>

    <div class="card">
      <h2>👥 Existing Users (${users.length})</h2>
      <div class="users-list">
        ${users.length === 0 ? '<div class="empty">No users yet. Create your first test user above!</div>' : ''}
        ${users.map(user => {
          const profile = profileMap.get(user.id);
          const phone = user.phone || 'No phone';
          const displayPhone = phone.startsWith('+') ? phone : '+' + phone;
          return `
            <div class="user-item" data-user-id="${user.id}">
              <div class="user-info">
                <div class="user-phone">
                  ${displayPhone}
                  ${user.phone_confirmed_at ? '<span class="badge verified">Verified</span>' : '<span class="badge unverified">Unverified</span>'}
                </div>
                <div class="user-meta">
                  ${profile?.name || 'No name'} • Created ${new Date(user.created_at).toLocaleDateString()}
                </div>
                <div class="user-id">${user.id}</div>
              </div>
              <button class="danger" onclick="deleteUser('${user.id}', '${displayPhone}')">Delete</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const adminPassword = '${password}';
    const baseUrl = window.location.origin + window.location.pathname;

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast ' + type + ' show';
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    document.getElementById('createUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('createBtn');
      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
        const response = await fetch(baseUrl + '?password=' + adminPassword, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: document.getElementById('phone').value,
            userPassword: document.getElementById('userPassword').value,
            name: document.getElementById('name').value
          })
        });

        const data = await response.json();
        
        if (data.success) {
          showToast('✅ User created successfully!');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('❌ ' + data.error, 'error');
        }
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
      }

      btn.disabled = false;
      btn.textContent = 'Create User';
    });

    async function deleteUser(userId, phone) {
      if (!confirm('Delete user ' + phone + '?')) return;

      try {
        const response = await fetch(baseUrl + '?password=' + adminPassword, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        const data = await response.json();
        
        if (data.success) {
          showToast('✅ User deleted');
          document.querySelector('[data-user-id="' + userId + '"]').remove();
        } else {
          showToast('❌ ' + data.error, 'error');
        }
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
      }
    }
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html" }
  });
});
