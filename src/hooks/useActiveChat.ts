import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ActiveChat {
  activityType: string;
  city: string;
  hasUnread: boolean;
}

export function useActiveChat(city: string = "New York") {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkActiveChat = useCallback(async () => {
    if (!user) {
      setActiveChat(null);
      setIsLoading(false);
      return;
    }

    try {
      // Get user's active activity joins for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("activity_type, city")
        .eq("user_id", user.id)
        .eq("city", city)
        .gt("expires_at", new Date().toISOString())
        .order("joined_at", { ascending: false })
        .limit(1);

      if (joinsError || !joins || joins.length === 0) {
        setActiveChat(null);
        setIsLoading(false);
        return;
      }

      const mostRecentJoin = joins[0];

      // Get last read timestamp for this activity
      const { data: readStatus } = await supabase
        .from("activity_read_status")
        .select("last_read_at")
        .eq("user_id", user.id)
        .eq("activity_type", mostRecentJoin.activity_type)
        .eq("city", mostRecentJoin.city)
        .maybeSingle();

      // Check for unread messages
      const lastReadAt = readStatus?.last_read_at || today.toISOString();

      const { count: unreadCount } = await supabase
        .from("activity_messages")
        .select("*", { count: "exact", head: true })
        .eq("activity_type", mostRecentJoin.activity_type)
        .eq("city", mostRecentJoin.city)
        .gt("created_at", lastReadAt)
        .neq("user_id", user.id);

      setActiveChat({
        activityType: mostRecentJoin.activity_type,
        city: mostRecentJoin.city,
        hasUnread: (unreadCount || 0) > 0,
      });
    } catch (error) {
      console.error("Error checking active chat:", error);
      setActiveChat(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, city]);

  // Mark messages as read
  const markAsRead = useCallback(async (activityType: string, chatCity: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("activity_read_status")
        .upsert(
          {
            user_id: user.id,
            activity_type: activityType,
            city: chatCity,
            last_read_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,activity_type,city",
          }
        );

      if (error) throw error;

      // Update local state
      setActiveChat((prev) =>
        prev ? { ...prev, hasUnread: false } : null
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }, [user]);

  // Initial check
  useEffect(() => {
    checkActiveChat();
  }, [checkActiveChat]);

  // Subscribe to new messages for real-time unread updates
  useEffect(() => {
    if (!user || !activeChat) return;

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_messages",
        },
        (payload) => {
          const newMessage = payload.new as { user_id: string; activity_type: string; city: string };
          if (
            newMessage.activity_type === activeChat.activityType &&
            newMessage.city === activeChat.city &&
            newMessage.user_id !== user.id
          ) {
            setActiveChat((prev) =>
              prev ? { ...prev, hasUnread: true } : null
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeChat?.activityType, activeChat?.city]);

  return { activeChat, isLoading, markAsRead, refreshActiveChat: checkActiveChat };
}
