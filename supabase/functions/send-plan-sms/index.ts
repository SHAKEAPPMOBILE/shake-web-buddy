import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid notification types
const VALID_NOTIFICATION_TYPES = ['plan_join', 'plan_message'] as const;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SMSRequest {
  notificationType: typeof VALID_NOTIFICATION_TYPES[number];
  activityId: string;
  senderName?: string;
  messagePreview?: string;
}

function validateRequest(data: unknown): { valid: true; data: SMSRequest } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: "Invalid request body" };
  }

  const { notificationType, activityId, senderName, messagePreview } = data as Record<string, unknown>;

  // Validate notificationType
  if (typeof notificationType !== 'string' || !VALID_NOTIFICATION_TYPES.includes(notificationType as typeof VALID_NOTIFICATION_TYPES[number])) {
    return { valid: false, error: `Invalid notificationType. Must be one of: ${VALID_NOTIFICATION_TYPES.join(', ')}` };
  }

  // Validate activityId as UUID
  if (typeof activityId !== 'string' || !UUID_REGEX.test(activityId)) {
    return { valid: false, error: "Invalid activityId format" };
  }

  // Validate optional senderName
  const sanitizedSenderName = typeof senderName === 'string' 
    ? senderName.replace(/[^\w\s-]/g, '').substring(0, 50) 
    : undefined;

  // Validate optional messagePreview
  const sanitizedMessagePreview = typeof messagePreview === 'string'
    ? messagePreview.replace(/[^\w\s.,!?-]/g, '').substring(0, 100)
    : undefined;

  return {
    valid: true,
    data: {
      notificationType: notificationType as typeof VALID_NOTIFICATION_TYPES[number],
      activityId,
      senderName: sanitizedSenderName,
      messagePreview: sanitizedMessagePreview,
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

    const { notificationType, activityId, senderName, messagePreview } = validation.data;
    console.log("SMS notification request:", { notificationType, activityId, senderName });

    // Get the activity details
    const { data: activity, error: activityError } = await supabase
      .from("user_activities")
      .select("user_id, activity_type, city")
      .eq("id", activityId)
      .single();

    if (activityError || !activity) {
      console.error("Error fetching activity:", activityError);
      return new Response(
        JSON.stringify({ error: "Activity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the plan owner's private profile for phone number
    const { data: ownerPrivateProfile, error: ownerError } = await supabase
      .from("profiles_private")
      .select("phone_number, sms_notifications_enabled")
      .eq("user_id", activity.user_id)
      .single();

    if (ownerError) {
      console.error("Error fetching owner profile:", ownerError);
    }

    // Don't notify the owner if they're the one who triggered the event
    if (activity.user_id === user.id) {
      console.log("User is the plan owner, not sending self-notification");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if owner has a phone number and SMS notifications enabled
    if (!ownerPrivateProfile?.phone_number || 
        !ownerPrivateProfile.sms_notifications_enabled) {
      console.log("Owner has no phone number or SMS notifications disabled");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Twilio credentials not configured");
      throw new Error("Twilio credentials not configured");
    }

    // Format phone number
    let phoneNumber = ownerPrivateProfile.phone_number.trim();
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+1" + phoneNumber;
    }

    // Build the message based on notification type
    let message: string;
    const activityLabel = activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1);
    
    if (notificationType === 'plan_join') {
      message = `🎉 ${senderName || "Someone"} just joined your ${activityLabel} plan in ${activity.city}! Open Shake to say hi.`;
    } else if (notificationType === 'plan_message') {
      const preview = messagePreview ? `"${messagePreview}"` : "";
      message = `💬 ${senderName || "Someone"} in your ${activityLabel} plan: ${preview || "sent a message"}. Open Shake to reply.`;
    } else {
      message = `📱 New activity in your ${activityLabel} plan. Open Shake to check it out!`;
    }

    console.log(`Sending SMS to plan owner ${phoneNumber}: ${message}`);

    // Send SMS via Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: twilioPhone,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send SMS to ${phoneNumber}:`, errorText);
      throw new Error(`Failed to send SMS: ${errorText}`);
    }

    const result = await response.json();
    console.log(`SMS sent successfully to ${phoneNumber}:`, result.sid);

    return new Response(
      JSON.stringify({ success: true, notified: 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-plan-sms:", error);
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
