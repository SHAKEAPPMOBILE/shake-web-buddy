import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  activityType: string;
  city: string;
  joinerName: string;
  joinerUserId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activityType, city, joinerName, joinerUserId }: SMSRequest = await req.json();
    
    console.log("SMS notification request:", { activityType, city, joinerName, joinerUserId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users who joined the same activity today (excluding the current joiner)
    const { data: activeJoins, error: joinsError } = await supabase
      .from("activity_joins")
      .select("user_id")
      .eq("activity_type", activityType)
      .eq("city", city)
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", joinerUserId);

    if (joinsError) {
      console.error("Error fetching active joins:", joinsError);
      throw joinsError;
    }

    if (!activeJoins || activeJoins.length === 0) {
      console.log("No other users to notify");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(activeJoins.map(join => join.user_id))];
    console.log("Users to notify:", userIds);

    // Get phone numbers from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, phone_number, name")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Filter profiles with valid phone numbers
    const profilesWithPhone = profiles?.filter(p => p.phone_number && p.phone_number.trim() !== "") || [];
    console.log("Profiles with phone numbers:", profilesWithPhone.length);

    if (profilesWithPhone.length === 0) {
      console.log("No users with phone numbers to notify");
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

    // Send SMS to each user
    const results = await Promise.allSettled(
      profilesWithPhone.map(async (profile) => {
        const message = `🎉 ${joinerName || "Someone"} just joined ${activityType} in ${city}! Open Shake to connect.`;
        
        // Format phone number (ensure it has country code)
        let phoneNumber = profile.phone_number.trim();
        if (!phoneNumber.startsWith("+")) {
          phoneNumber = "+1" + phoneNumber; // Default to US if no country code
        }

        console.log(`Sending SMS to ${phoneNumber}`);

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
        return result;
      })
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failedCount = results.filter(r => r.status === "rejected").length;

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
