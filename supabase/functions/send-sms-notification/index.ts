import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VonageSMSService } from "../_shared/vonage-sms-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid activity types for validation (must match src/data/activityTypes.ts)
const VALID_ACTIVITY_TYPES = [
  'lunch', 'dinner', 'drinks', 'brunch', 'hike', 'surf', 'run', 'co-working',
  'basketball', 'tennis-padel', 'football', 'shopping', 'arts', 'sunset', 'dance'
] as const;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SMSRequest {
  activityType: string;
  city: string;
  joinerName: string;
  joinerUserId: string;
}

function validateRequest(data: unknown): { valid: true; data: SMSRequest } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: "Invalid request body" };
  }

  const { activityType, city, joinerName, joinerUserId } = data as Record<string, unknown>;

  // Validate activityType
  if (typeof activityType !== 'string' || !VALID_ACTIVITY_TYPES.includes(activityType as typeof VALID_ACTIVITY_TYPES[number])) {
    return { valid: false, error: `Invalid activityType. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}` };
  }

  // Validate city
  if (typeof city !== 'string' || city.length < 1 || city.length > 100) {
    return { valid: false, error: "City must be a string between 1 and 100 characters" };
  }

  // Validate joinerName (sanitize for SMS content)
  if (typeof joinerName !== 'string' || joinerName.length < 1 || joinerName.length > 100) {
    return { valid: false, error: "Joiner name must be a string between 1 and 100 characters" };
  }

  // Validate joinerUserId as UUID
  if (typeof joinerUserId !== 'string' || !UUID_REGEX.test(joinerUserId)) {
    return { valid: false, error: "Invalid joinerUserId format" };
  }

  // Sanitize joinerName to prevent SMS injection (remove special characters that could affect SMS)
  const sanitizedJoinerName = joinerName.replace(/[^\w\s-]/g, '').substring(0, 50);

  return {
    valid: true,
    data: {
      activityType,
      city: city.substring(0, 100),
      joinerName: sanitizedJoinerName,
      joinerUserId,
    }
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Parse and validate request body
    const rawBody = await req.json();
    const validation = validateRequest(rawBody);

    if (!validation.valid) {
      console.error("Validation error:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { activityType, city, joinerName, joinerUserId } = validation.data;

    // Verify the authenticated user matches the joinerUserId
    if (user.id !== joinerUserId) {
      console.error("User ID mismatch: authenticated user", user.id, "vs joiner", joinerUserId);
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS notification request validated:", { activityType, city, joinerName, joinerUserId });

    // Check if this is the first activity join of the day for this city
    // If so, we'll trigger the daily city SMS instead (handled separately)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { data: existingDailyNotification } = await supabase
      .from("daily_sms_tracking")
      .select("id")
      .eq("city", city)
      .eq("notification_type", "first_activity_join")
      .eq("notification_date", today)
      .maybeSingle();

    // If no daily notification has been sent yet, this is the first join of the day
    // The daily notification will be handled by the calling code via send-daily-city-sms
    // Here we just notify users who are ALREADY joined in the same activity
    
    // Get all users who joined THE SAME activity type in the same city (excluding the current joiner)
    const { data: activeJoins, error: joinsError } = await supabase
      .from("activity_joins")
      .select("user_id")
      .eq("city", city)
      .eq("activity_type", activityType)
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", joinerUserId);

    if (joinsError) {
      console.error("Error fetching active joins:", joinsError);
      throw joinsError;
    }

    if (!activeJoins || activeJoins.length === 0) {
      console.log("No other users in the same activity to notify");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(activeJoins.map(join => join.user_id))];
    console.log("Users to notify:", userIds);

    // Get phone numbers and notification preferences from profiles_private (service role has full access)
    const { data: privateProfiles, error: privateProfilesError } = await supabase
      .from("profiles_private")
      .select("user_id, phone_number, sms_notifications_enabled")
      .in("user_id", userIds);

    if (privateProfilesError) {
      console.error("Error fetching private profiles:", privateProfilesError);
      throw privateProfilesError;
    }

    // Get names from public profiles
    const { data: publicProfiles, error: publicProfilesError } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", userIds);

    if (publicProfilesError) {
      console.error("Error fetching public profiles:", publicProfilesError);
      throw publicProfilesError;
    }

    // Combine phone numbers with names, respecting notification preferences
    const nameMap = new Map(publicProfiles?.map(p => [p.user_id, p.name]) || []);
    const profilesWithPhone = privateProfiles?.filter(p => 
      p.phone_number && 
      p.phone_number.trim() !== "" && 
      p.sms_notifications_enabled !== false // Only include users who haven't opted out
    ).map(p => ({
      user_id: p.user_id,
      phone_number: p.phone_number,
      name: nameMap.get(p.user_id) || null
    })) || [];
    
    console.log("Profiles with phone numbers and notifications enabled:", profilesWithPhone.length);

    if (profilesWithPhone.length === 0) {
      console.log("No users with phone numbers to notify (or all opted out)");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Vonage SMS service
    const smsService = VonageSMSService.fromEnv();

    // Prepare message
    const message = `🎉 ${joinerName || "Someone"} just joined ${activityType} in ${city}! Open Shake to connect.`;
    
    // Send SMS to each user using Vonage
    const phoneNumbers = profilesWithPhone.map(p => p.phone_number);
    const results = await smsService.sendBulkSMS(phoneNumbers, message);

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`SMS notifications: ${successCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ success: true, notified: successCount, failed: failedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-sms-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
