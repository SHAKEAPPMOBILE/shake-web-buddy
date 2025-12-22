import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playNotificationSound } from "@/lib/notification-sound";
import { getActivityLabel } from "@/data/activityTypes";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const notificationPermission = useRef<NotificationPermission>("default");
  const clickHandlers = useRef<Map<string, () => void>>(new Map());

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      notificationPermission.current = "granted";
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      notificationPermission.current = permission;
      return permission === "granted";
    }

    return false;
  }, []);

  // Show a notification
  const showNotification = useCallback(({ title, body, icon, tag, onClick }: NotificationOptions) => {
    if (notificationPermission.current !== "granted") {
      // Still play sound even without notification permission
      playNotificationSound();
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || "/favicon.png",
        tag: tag || `notification-${Date.now()}`,
        badge: "/favicon.png",
        requireInteraction: false,
      });

      if (onClick) {
        const notificationTag = tag || `notification-${Date.now()}`;
        clickHandlers.current.set(notificationTag, onClick);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
          onClick();
        };
      }

      playNotificationSound();

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error("Error showing notification:", error);
      playNotificationSound();
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      notificationPermission.current = Notification.permission;
    }
  }, []);

  return {
    requestPermission,
    showNotification,
    hasPermission: notificationPermission.current === "granted",
  };
}

// Hook to listen for plan-related notifications
export function usePlanNotifications(
  myActivityIds: string[],
  onJoinNotification?: (activityId: string, joinerName: string) => void,
  onMessageNotification?: (activityId: string, senderName: string, message: string) => void
) {
  const { user } = useAuth();
  const { showNotification, requestPermission } = usePushNotifications();
  const processedEvents = useRef<Set<string>>(new Set());

  // Request permission when user has activities
  useEffect(() => {
    if (myActivityIds.length > 0) {
      requestPermission();
    }
  }, [myActivityIds.length, requestPermission]);

  // Listen for new joins on user's activities
  useEffect(() => {
    if (!user || myActivityIds.length === 0) return;

    console.log("Setting up plan notifications for activities:", myActivityIds);

    const channel = supabase
      .channel("plan-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_joins",
        },
        async (payload) => {
          const join = payload.new as {
            id: string;
            activity_id: string;
            user_id: string;
          };

          // Ignore if this is our own join or not for our activities
          if (join.user_id === user.id) return;
          if (!join.activity_id || !myActivityIds.includes(join.activity_id)) return;
          
          // Prevent duplicate notifications
          const eventKey = `join-${join.id}`;
          if (processedEvents.current.has(eventKey)) return;
          processedEvents.current.add(eventKey);

          // Get joiner's profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", join.user_id)
            .single();

          // Get activity details
          const { data: activity } = await supabase
            .from("user_activities")
            .select("activity_type")
            .eq("id", join.activity_id)
            .single();

          const joinerName = profile?.name || "Someone";
          const activityLabel = activity?.activity_type
            ? getActivityLabel(activity.activity_type)
            : "your plan";

          showNotification({
            title: "New plan participant! 🎉",
            body: `${joinerName} just joined your ${activityLabel} plan`,
            tag: `join-${join.id}`,
          });

          onJoinNotification?.(join.activity_id, joinerName);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
        },
        async (payload) => {
          const message = payload.new as {
            id: string;
            activity_id: string;
            user_id: string;
            message: string;
          };

          // Ignore our own messages
          if (message.user_id === user.id) return;
          if (!myActivityIds.includes(message.activity_id)) return;

          // Prevent duplicate notifications
          const eventKey = `msg-${message.id}`;
          if (processedEvents.current.has(eventKey)) return;
          processedEvents.current.add(eventKey);

          // Get sender's profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", message.user_id)
            .single();

          const senderName = profile?.name || "Someone";
          const truncatedMessage =
            message.message.length > 50
              ? message.message.substring(0, 50) + "..."
              : message.message;

          showNotification({
            title: `${senderName} sent a message`,
            body: truncatedMessage,
            tag: `msg-${message.id}`,
          });

          onMessageNotification?.(message.activity_id, senderName, message.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, myActivityIds, showNotification, onJoinNotification, onMessageNotification]);

  return { requestPermission };
}
