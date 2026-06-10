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

    const { user_id: sender_id, activity_id, message } = payload.record;
    if (!activity_id) return new Response(JSON.stringify({ skipped: true }));

    const { data: senderProfile } = await supabase
      .from("profiles").select("name").eq("user_id", sender_id).maybeSingle();
    const senderName = senderProfile?.name?.trim() || "Someone";
    const preview = (message ?? "").trim().slice(0, 50) + ((message ?? "").length > 50 ? "..." : "");

    const { data: joins } = await supabase
      .from("activity_joins").select("user_id")
      .eq("activity_id", activity_id).neq("user_id", sender_id);

    const { data: plan } = await supabase
      .from("user_activities").select("user_id")
      .eq("id", activity_id).maybeSingle();

    const recipients = new Set((joins || []).map((j) => j.user_id));
    if (plan?.user_id && plan.user_id !== sender_id) recipients.add(plan.user_id);

    console.log("sender:" + sender_id + " creator:" + plan?.user_id + " recipients:" + JSON.stringify([...recipients]));

    const sendPushUrl = supabaseUrl + "/functions/v1/send-push-notification";
    let notified = 0;

    for (const userId of recipients) {
      const res = await fetch(sendPushUrl, {
        method: "POST",
        headers: { "Authorization": "Bearer " + serviceRoleKey, "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: userId, title: senderName + " sent a message", body: preview, data: { tab: "chat", activity_id: activity_id } }),
      });
      const txt = await res.text();
      console.log("push " + userId + ": " + txt);
      if (res.ok) notified++;
    }

    console.log("Notified " + notified);
    return new Response(JSON.stringify({ success: true, notified }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), { status: 500 });
  }
});
