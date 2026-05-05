import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ skipped: true }));
    }

    const { user_id: sender_id, activity_type, city, message } = payload.record;

    const { data: senderProfile } = await supabase
      .from("profiles").select("name").eq("user_id", sender_id).maybeSingle();
    const senderName = senderProfile?.name?.trim() || "Someone";
    const preview = (message ?? "").trim().slice(0, 50) + ((message ?? "").length > 50 ? "..." : "");

    const { data: joins } = await supabase
      .from("activity_joins")
      .select("user_id")
      .eq("activity_type", activity_type)
      .eq("city", city)
      .neq("user_id", sender_id);

    if (!joins || joins.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }));
    }

    const sendPushUrl = supabaseUrl + "/functions/v1/send-push-notification";
    let notified = 0;

    for (const join of joins) {
      const pushRes = await fetch(sendPushUrl, {
        method: "POST",
        headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZ3JqenViZWdvcmNpamdmanJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI4OTYwOSwiZXhwIjoyMDg2ODY1NjA5fQ.A19GJUSvFEKj83PeAv0ti_mzp3vNPU8lJCDALZi957Q", "Content-Type": "application/json" },
        body: JSON.stringify({
          to_user_id: join.user_id,
          title: senderName + " sent a message",
          body: preview,
          data: { tab: "chat" },
        }),
      });
      if (pushRes.ok) notified++;
    }

    console.log("Notified " + notified);
    return new Response(JSON.stringify({ success: true, notified }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
