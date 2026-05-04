import { useEffect, useRef } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";

export function useCapacitorPushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform() || initialized.current) return;
    initialized.current = true;

    let registrationHandle: { remove: () => Promise<void> } | null = null;
    let receivedHandle: { remove: () => Promise<void> } | null = null;
    let actionHandle: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      console.log("[Push] Setup starting — requesting permissions");
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== "granted") {
        console.log("[Push] Permission denied:", result.receive);
        return;
      }

      let tokenReceived = false;

      registrationHandle = await PushNotifications.addListener("registration", async (token) => {
        tokenReceived = true;
        console.log("[Push] Token received:", token.value);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) {
          console.error("[Push] No active session when saving token — aborting save. Session error:", sessionError);
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ push_token: token.value })
          .eq("user_id", user.id);

        if (error) {
          console.error("[Push] Failed to save push token. Full error:", JSON.stringify(error));
        } else {
          console.log("[Push] Token saved successfully for user:", user.id);
        }
      });

      await PushNotifications.register();
      console.log("[Push] Registration called");

      // Retry once after 10 seconds if no token event fired
      setTimeout(async () => {
        if (!tokenReceived) {
          console.warn("[Push] No registration event after 10s — retrying register()");
          try {
            await PushNotifications.register();
            console.log("[Push] Retry register() called");
          } catch (err) {
            console.error("[Push] Retry register() failed:", err);
          }
        }
      }, 10_000);

      receivedHandle = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[Push] Notification received (foreground):", JSON.stringify(notification));
        toast.info(notification.title ?? "New notification", {
          description: notification.body ?? undefined,
        });
      });

      actionHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = action.notification.data as Record<string, string> | undefined;
        if (!data) return;

        if (data.tab) {
          navigate("/", { state: { activeTab: data.tab } });
        } else if (data.screen === "events") {
          navigate("/", { state: { openEvents: true } });
        }
      });
    };

    setup().catch((err) => {
      console.error("[PushNotifications] Setup error:", err);
    });

    return () => {
      initialized.current = false;
      registrationHandle?.remove();
      receivedHandle?.remove();
      actionHandle?.remove();
    };
  }, [user, navigate]);
}
