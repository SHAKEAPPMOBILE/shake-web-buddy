import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "./usePushNotifications";

export function usePrivateMessageNotifications(
  onMessageNotification?: (senderId: string, senderName: string, message: string) => void
) {
  const { user } = useAuth();
  const { showNotification, requestPermission, hasPermission } = usePushNotifications();
  const processedEvents = useRef<Set<string>>(new Set());
  const [pushEnabled, setPushEnabled] = useState(true);

  // Fetch push notification preference
  useEffect(() => {
    if (!user) return;

    const fetchPreference = async () => {
      const { data } = await supabase
        .from("profiles_private")
        .select("push_notifications_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPushEnabled(data.push_notifications_enabled);
      }
    };

    fetchPreference();
  }, [user]);

  // Request permission on mount
  useEffect(() => {
    if (user && pushEnabled) {
      requestPermission();
    }
  }, [user, pushEnabled, requestPermission]);

  // Listen for new private messages
  useEffect(() => {
    if (!user || !pushEnabled) return;

    const channel = supabase
      .channel("private-message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
        },
        async (payload) => {
          const message = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            message: string;
          };

          // Only notify if we're the receiver
          if (message.receiver_id !== user.id) return;

          // Prevent duplicate notifications
          const eventKey = `private-msg-${message.id}`;
          if (processedEvents.current.has(eventKey)) return;
          processedEvents.current.add(eventKey);

          // Get sender's profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", message.sender_id)
            .maybeSingle();

          const senderName = profile?.name || "Someone";
          const truncatedMessage =
            message.message.length > 50
              ? message.message.substring(0, 50) + "..."
              : message.message;

          showNotification({
            title: `New message from ${senderName}`,
            body: truncatedMessage,
            tag: `private-msg-${message.id}`,
          });

          onMessageNotification?.(message.sender_id, senderName, message.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, pushEnabled, showNotification, onMessageNotification]);

  return { requestPermission, hasPermission, pushEnabled };
}
