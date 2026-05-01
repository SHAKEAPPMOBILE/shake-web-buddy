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
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== "granted") {
        console.log("[Push] Permission denied:", result.receive);
        return;
      }

      await PushNotifications.register();
      console.log("[Push] Registration called");

      registrationHandle = await PushNotifications.addListener("registration", async (token) => {
        console.log("[Push] Token received:", token.value);
        const { error } = await supabase
          .from("profiles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ push_token: token.value } as any)
          .eq("id", user.id);

        console.log("[Push] Token save result:", error ? error : "success");
        if (error) {
          console.error("[PushNotifications] Failed to save push token:", error);
        }
      });

      receivedHandle = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
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
