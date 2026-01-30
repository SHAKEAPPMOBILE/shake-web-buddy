import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Random first names for test users
const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "William", "Mia", "James", "Charlotte", "Oliver", "Amelia",
  "Benjamin", "Harper", "Elijah", "Evelyn", "Lucas", "Luna", "Leo", "Aria",
  "Jack", "Chloe", "Henry", "Ella", "Sebastian", "Lily", "Alexander",
  "Sofia", "Michael", "Layla", "Daniel", "Riley", "Matthew", "Zoey",
  "Jackson", "Nora", "David", "Victoria", "Samuel", "Scarlett", "Joseph",
  "Hannah", "Carter", "Addison", "Owen", "Aubrey", "Wyatt", "Ellie"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King"
];

// Available avatar URLs from the app's assets
const AVATAR_URLS = [
  "/src/assets/avatar-new-1.png",
  "/src/assets/avatar-new-2.png",
  "/src/assets/avatar-new-3.png",
  "/src/assets/avatar-new-4.png",
  "/src/assets/avatar-new-5.png",
  "/src/assets/avatar-new-6.png",
  "/src/assets/avatar-new-7.png",
  "/src/assets/avatar-new-8.png",
  "/src/assets/avatar-new-9.png",
  "/src/assets/avatar-new-11.png",
  "/src/assets/avatar-new-12.png",
  "/src/assets/avatar-new-13.png",
  "/src/assets/avatar-new-14.png",
  "/src/assets/avatar-new-15.png",
  "/src/assets/avatar-new-16.png",
  "/src/assets/avatar-new-17.png",
  "/src/assets/avatar-new-18.png",
  "/src/assets/avatar-new-20.png",
  "/src/assets/avatar-new-21.png",
  "/src/assets/avatar-new-22.png",
  "/src/assets/avatar-new-23.png",
  "/src/assets/avatar-new-24.png",
  "/src/assets/avatar-new-25.png",
  "/src/assets/avatar-new-26.png",
  "/src/assets/avatar-new-27.png",
  "/src/assets/avatar-new-28.png",
  "/src/assets/avatar-new-30.png"
];

function getRandomName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

function getRandomAvatar(): string {
  return AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)];
}

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

      // Generate random name and avatar if not provided
      const userName = name?.trim() || getRandomName();
      const userAvatar = getRandomAvatar();

      // Create new user with phone and password - phone verified!
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: cleanPhone,
        password: userPassword,
        phone_confirm: true, // Skip phone verification - user can login immediately
        user_metadata: { name: userName, admin_password: userPassword }
      });

      if (createError) {
        console.error("[ADMIN] Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newUser?.user) {
        console.log(`[ADMIN] Created user ${cleanPhone} with ID: ${newUser.user.id}, name: ${userName}`);

        // Create profile with random name and avatar
        await supabaseAdmin.from("profiles").upsert({
          user_id: newUser.user.id,
          name: userName,
          avatar_url: userAvatar,
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
  
  // Handle list-users action - returns all users with profile data
  if (action === "list-users") {
    try {
      // Get all users from auth
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const users = usersData?.users || [];
      
      // Get profiles for names
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, name, created_at");
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      // Get private profiles for phone and premium status
      const { data: privateProfiles } = await supabaseAdmin.from("profiles_private").select("user_id, phone_number, premium_override");
      const privateProfileMap = new Map(privateProfiles?.map(p => [p.user_id, p]) || []);
      
      // Build user list with all data
      const allUsers = users.map(user => {
        const profile = profileMap.get(user.id);
        const privateProfile = privateProfileMap.get(user.id);
        return {
          user_id: user.id,
          name: profile?.name || user.user_metadata?.name || null,
          phone_number: privateProfile?.phone_number || (user.phone ? (user.phone.startsWith('+') ? user.phone : '+' + user.phone) : null),
          created_at: profile?.created_at || user.created_at,
          isPremium: privateProfile?.premium_override || false,
          password: user.user_metadata?.admin_password || null,
        };
      });
      
      console.log(`[ADMIN] list-users: returning ${allUsers.length} users`);
      
      return new Response(
        JSON.stringify({ success: true, users: allUsers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] list-users error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle list-payouts action - returns creator payout information
  if (action === "list-payouts") {
    try {
      console.log("[ADMIN] list-payouts: fetching creator payout data");
      
      // Get all paid activities
      const { data: activities, error: activitiesError } = await supabaseAdmin
        .from("user_activities")
        .select("id, user_id, activity_type, city, note, price_amount, scheduled_for, created_at")
        .not("price_amount", "is", null)
        .eq("is_active", true);

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        return new Response(
          JSON.stringify({ success: true, payouts: [], payout_history: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get activity joins for participant counts
      const activityIds = activities.map(a => a.id);
      const { data: joins } = await supabaseAdmin
        .from("activity_joins")
        .select("activity_id, user_id, joined_at")
        .in("activity_id", activityIds);

      // Count participants per activity
      const participantCounts: Record<string, number> = {};
      const joinDetails: Record<string, Array<{ user_id: string; joined_at: string }>> = {};
      (joins || []).forEach(join => {
        if (join.activity_id) {
          participantCounts[join.activity_id] = (participantCounts[join.activity_id] || 0) + 1;
          if (!joinDetails[join.activity_id]) joinDetails[join.activity_id] = [];
          joinDetails[join.activity_id].push({ user_id: join.user_id, joined_at: join.joined_at });
        }
      });

      // Get unique creator user IDs
      const creatorIds = [...new Set(activities.map(a => a.user_id))];

      // Get profiles for names
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, name")
        .in("user_id", creatorIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get private profiles for payout info
      const { data: privateProfiles } = await supabaseAdmin
        .from("profiles_private")
        .select("user_id, phone_number, preferred_payout_method, stripe_account_id, stripe_account_status, billing_email, paypal_connected, paypal_email")
        .in("user_id", creatorIds);
      const privateProfileMap = new Map(privateProfiles?.map(p => [p.user_id, p]) || []);

      // Get payout history
      const { data: payoutHistory } = await supabaseAdmin
        .from("creator_payouts")
        .select("*")
        .order("paid_at", { ascending: false });

      // Parse price string
      function parsePriceString(priceString: string): { amount: number; currency: string } {
        const match = priceString.match(/([€$£¥R])?(\d+(?:\.\d+)?)\s*(\w+)?/);
        if (match) {
          const amount = parseFloat(match[2]);
          let currency = match[3] || "USD";
          if (!match[3]) {
            const symbolMap: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "R": "BRL" };
            if (match[1] && symbolMap[match[1]]) currency = symbolMap[match[1]];
          }
          return { amount, currency };
        }
        return { amount: 0, currency: "USD" };
      }

      // Calculate already paid amounts per creator
      const paidAmounts: Record<string, number> = {};
      (payoutHistory || []).forEach(payout => {
        paidAmounts[payout.creator_user_id] = (paidAmounts[payout.creator_user_id] || 0) + Number(payout.amount);
      });

      // Calculate earnings per creator
      const creatorEarnings: Record<string, {
        total_gross: number;
        total_net: number;
        currency: string;
        activity_count: number;
        participant_count: number;
        activities: Array<{
          id: string;
          type: string;
          city: string;
          note: string | null;
          price: string;
          participants: number;
          gross: number;
          net: number;
          scheduled_for: string;
          created_at: string;
        }>;
      }> = {};

      activities.forEach(activity => {
        const participants = participantCounts[activity.id] || 0;
        const { amount, currency } = parsePriceString(activity.price_amount || "");
        const gross = amount * participants;
        const net = gross * 0.85; // 85% after platform fee

        if (!creatorEarnings[activity.user_id]) {
          creatorEarnings[activity.user_id] = {
            total_gross: 0,
            total_net: 0,
            currency,
            activity_count: 0,
            participant_count: 0,
            activities: [],
          };
        }

        creatorEarnings[activity.user_id].total_gross += gross;
        creatorEarnings[activity.user_id].total_net += net;
        creatorEarnings[activity.user_id].activity_count += 1;
        creatorEarnings[activity.user_id].participant_count += participants;
        creatorEarnings[activity.user_id].activities.push({
          id: activity.id,
          type: activity.activity_type,
          city: activity.city,
          note: activity.note,
          price: activity.price_amount || "",
          participants,
          gross,
          net,
          scheduled_for: activity.scheduled_for,
          created_at: activity.created_at,
        });
      });

      // Build payout list
      const payouts = creatorIds.map(userId => {
        const profile = profileMap.get(userId);
        const privateProfile = privateProfileMap.get(userId);
        const earnings = creatorEarnings[userId] || { 
          total_gross: 0, total_net: 0, currency: "USD", activity_count: 0, participant_count: 0, activities: [] 
        };
        const alreadyPaid = paidAmounts[userId] || 0;
        const pendingPayout = Math.max(0, earnings.total_net - alreadyPaid);

        return {
          user_id: userId,
          name: profile?.name || null,
          phone_number: privateProfile?.phone_number || null,
          preferred_payout_method: privateProfile?.preferred_payout_method || null,
          stripe_account_id: privateProfile?.stripe_account_id || null,
          stripe_account_status: privateProfile?.stripe_account_status || null,
          stripe_email: privateProfile?.billing_email || null,
          paypal_connected: privateProfile?.paypal_connected || false,
          paypal_email: privateProfile?.paypal_email || null,
          total_gross: earnings.total_gross,
          total_net: earnings.total_net,
          already_paid: alreadyPaid,
          pending_payout: pendingPayout,
          currency: earnings.currency,
          activity_count: earnings.activity_count,
          participant_count: earnings.participant_count,
          activities: earnings.activities,
        };
      });

      // Sort by pending payout (descending)
      payouts.sort((a, b) => b.pending_payout - a.pending_payout);

      console.log(`[ADMIN] list-payouts: returning ${payouts.length} creators`);

      return new Response(
        JSON.stringify({ success: true, payouts, payout_history: payoutHistory || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] list-payouts error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle mark-paid action - record a manual payout
  if (action === "mark-paid" && req.method === "POST") {
    try {
      const body = await req.json();
      const { creator_user_id, amount, payout_method, payout_email, stripe_account_id, notes, activity_ids } = body;

      if (!creator_user_id || !amount || !payout_method) {
        return new Response(
          JSON.stringify({ error: "creator_user_id, amount, and payout_method are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: payout, error: insertError } = await supabaseAdmin
        .from("creator_payouts")
        .insert({
          creator_user_id,
          amount: Number(amount),
          currency: "USD",
          payout_method,
          payout_email: payout_email || null,
          stripe_account_id: stripe_account_id || null,
          notes: notes || null,
          activity_ids: activity_ids || [],
          paid_by: "admin",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`[ADMIN] mark-paid: recorded payout of ${amount} to ${creator_user_id} via ${payout_method}`);

      return new Response(
        JSON.stringify({ success: true, payout }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] mark-paid error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle list-verifications action - returns all ID verifications with user info
  if (action === "list-verifications") {
    try {
      console.log("[ADMIN] list-verifications: fetching verification data");
      
      // Get all verifications
      const { data: verifications, error: verError } = await supabaseAdmin
        .from("creator_verifications")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (verError) throw verError;

      if (!verifications || verifications.length === 0) {
        return new Response(
          JSON.stringify({ success: true, verifications: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user info for each verification
      const userIds = [...new Set(verifications.map(v => v.user_id))];
      
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const { data: privateProfiles } = await supabaseAdmin
        .from("profiles_private")
        .select("user_id, billing_email")
        .in("user_id", userIds);
      const privateProfileMap = new Map(privateProfiles?.map(p => [p.user_id, p]) || []);

      const verificationsWithUsers = verifications.map(v => ({
        ...v,
        user_name: profileMap.get(v.user_id)?.name || null,
        user_email: privateProfileMap.get(v.user_id)?.billing_email || null,
      }));

      console.log(`[ADMIN] list-verifications: returning ${verificationsWithUsers.length} verifications`);

      return new Response(
        JSON.stringify({ success: true, verifications: verificationsWithUsers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] list-verifications error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle get-verification-document action - returns signed URL for document
  if (action === "get-verification-document") {
    try {
      const body = await req.json();
      const { documentPath } = body;

      if (!documentPath) {
        return new Response(
          JSON.stringify({ error: "Document path required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseAdmin.storage
        .from("id-verifications")
        .createSignedUrl(documentPath, 3600); // 1 hour expiry

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, signedUrl: data?.signedUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] get-verification-document error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Handle update-verification action - approve or reject verification
  if (action === "update-verification") {
    try {
      const body = await req.json();
      const { verificationId, status, rejectionReason } = body;

      if (!verificationId || !status) {
        return new Response(
          JSON.stringify({ error: "Verification ID and status required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, unknown> = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: "admin",
      };

      if (status === "rejected" && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabaseAdmin
        .from("creator_verifications")
        .update(updateData)
        .eq("id", verificationId);

      if (error) throw error;

      console.log(`[ADMIN] update-verification: ${verificationId} -> ${status}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("[ADMIN] update-verification error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
