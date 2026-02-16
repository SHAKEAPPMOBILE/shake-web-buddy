import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VonageSMSService } from "../_shared/vonage-sms-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid notification types
const VALID_NOTIFICATION_TYPES = ['first_plan', 'first_activity_join'] as const;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SMSRequest {
  notificationType: typeof VALID_NOTIFICATION_TYPES[number];
  city: string;
  triggerUserName: string;
  activityType?: string;
}

function validateRequest(data: unknown): { valid: true; data: SMSRequest } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: "Invalid request body" };
  }

  const { notificationType, city, triggerUserName, activityType } = data as Record<string, unknown>;

  // Validate notificationType
  if (typeof notificationType !== 'string' || !VALID_NOTIFICATION_TYPES.includes(notificationType as typeof VALID_NOTIFICATION_TYPES[number])) {
    return { valid: false, error: `Invalid notificationType. Must be one of: ${VALID_NOTIFICATION_TYPES.join(', ')}` };
  }

  // Validate city
  if (typeof city !== 'string' || city.length < 1 || city.length > 100) {
    return { valid: false, error: "City must be a string between 1 and 100 characters" };
  }

  // Validate triggerUserName (sanitize for SMS content)
  const sanitizedTriggerUserName = typeof triggerUserName === 'string' 
    ? triggerUserName.replace(/[^\w\s-]/g, '').substring(0, 50) 
    : "Someone";

  // Validate optional activityType
  const sanitizedActivityType = typeof activityType === 'string'
    ? activityType.replace(/[^\w\s-]/g, '').substring(0, 50)
    : undefined;

  return {
    valid: true,
    data: {
      notificationType: notificationType as typeof VALID_NOTIFICATION_TYPES[number],
      city: city.substring(0, 100),
      triggerUserName: sanitizedTriggerUserName,
      activityType: sanitizedActivityType,
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

    const { notificationType, city, triggerUserName, activityType } = validation.data;
    console.log("Daily city SMS request:", { notificationType, city, triggerUserName, activityType });

    // Check if we've already sent this type of notification for this city today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { data: existingNotification, error: checkError } = await supabase
      .from("daily_sms_tracking")
      .select("id")
      .eq("city", city)
      .eq("notification_type", notificationType)
      .eq("notification_date", today)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing notifications:", checkError);
      throw checkError;
    }

    if (existingNotification) {
      console.log(`Already sent ${notificationType} notification for ${city} today, skipping`);
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "already_sent_today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record this notification to prevent duplicates
    const { error: insertError } = await supabase
      .from("daily_sms_tracking")
      .insert({
        city,
        notification_type: notificationType,
        notification_date: today,
        triggered_by_user_id: user.id,
      });

    if (insertError) {
      // If unique constraint violation, another request beat us - that's fine
      if (insertError.code === '23505') {
        console.log(`Another request already recorded ${notificationType} for ${city} today`);
        return new Response(
          JSON.stringify({ success: true, notified: 0, reason: "already_sent_today" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Error recording notification:", insertError);
      throw insertError;
    }

    console.log(`First ${notificationType} of the day for ${city}, proceeding to notify users`);

    // Get all users with SMS enabled in this city (from profiles that have city info)
    // We'll notify all users who have phone numbers and SMS enabled
    const { data: privateProfiles, error: profilesError } = await supabase
      .from("profiles_private")
      .select("user_id, phone_number, sms_notifications_enabled")
      .eq("sms_notifications_enabled", true)
      .not("phone_number", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Filter out the user who triggered this and users without valid phone numbers
    const eligibleProfiles = privateProfiles?.filter(p => 
      p.user_id !== user.id && 
      p.phone_number && 
      p.phone_number.trim() !== ""
    ) || [];

    console.log(`Found ${eligibleProfiles.length} eligible users to notify`);

    if (eligibleProfiles.length === 0) {
      console.log("No users to notify");
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Vonage SMS service
    const smsService = VonageSMSService.fromEnv();

    // Build the message based on notification type
    let message: string;
    
    if (notificationType === 'first_plan') {
      const activityLabel = activityType 
        ? activityType.charAt(0).toUpperCase() + activityType.slice(1)
        : "a new plan";
      message = `📍 ${triggerUserName} just created ${activityLabel} in ${city}! Be the first to join. Open Shake to connect.`;
    } else if (notificationType === 'first_activity_join') {
      const activityLabel = activityType 
        ? activityType.charAt(0).toUpperCase() + activityType.slice(1)
        : "an activity";
      message = `🌅 Good news! ${triggerUserName} is the first to join ${activityLabel} in ${city} today! Open Shake to join in.`;
    } else {
      message = `📱 New activity in ${city}! Open Shake to check it out.`;
    }

    console.log(`Sending SMS to ${eligibleProfiles.length} users: ${message}`);

    // Send SMS to each user (limit to prevent excessive costs - max 50 per notification)
    const profilesToNotify = eligibleProfiles.slice(0, 50);
    const phoneNumbers = profilesToNotify.map(p => p.phone_number);
    
    const results = await smsService.sendBulkSMS(phoneNumbers, message);

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`Daily city SMS: ${successCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ success: true, notified: successCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-daily-city-sms:", error);
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
