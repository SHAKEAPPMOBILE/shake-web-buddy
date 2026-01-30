import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SCHEDULE-VERIFICATION-APPROVAL] ${step}${detailsStr}`);
};

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
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const body = await req.json();
    const { userId } = body;

    // Validate that the authenticated user matches the userId
    if (userId !== user.id) {
      throw new Error("Unauthorized");
    }

    logStep("Scheduling auto-approval", { userId });

    // Use background task to auto-approve after 1 hour
    EdgeRuntime.waitUntil((async () => {
      // Wait 1 hour (3600000 ms)
      await new Promise(resolve => setTimeout(resolve, 3600000));
      
      logStep("Auto-approval timer completed", { userId });

      // Check if still pending (not manually reviewed)
      const { data: verification } = await supabaseClient
        .from("creator_verifications")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      if (verification?.status === "pending") {
        // Auto-approve
        const { error } = await supabaseClient
          .from("creator_verifications")
          .update({
            status: "approved",
            auto_approved_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("status", "pending");

        if (error) {
          logStep("Error auto-approving", { error: error.message });
        } else {
          logStep("Auto-approved verification", { userId });
        }
      } else {
        logStep("Verification already reviewed, skipping auto-approval", { 
          userId, 
          currentStatus: verification?.status 
        });
      }
    })());

    return new Response(JSON.stringify({ 
      success: true,
      message: "Auto-approval scheduled for 1 hour from now"
    }), {
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
