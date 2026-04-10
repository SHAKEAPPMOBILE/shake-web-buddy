import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isEventChatMembershipExplicitlyExpired } from "@/lib/eventChatMembership";
import { EVENT_CHAT_VIEWED_EVENT, readEventChatLastSeenMap } from "@/lib/eventChatLastSeen";

export function useTotalUnreadChats() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const checkUnreadMessages = useCallback(async () => {
    if (!user?.id) {
      setTotalUnread(0);
      setIsLoading(false);
      return;
    }

    try {
      let total = 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Get user's active carousel joins
      const { data: carouselJoins } = await supabase
        .from("activity_joins")
        .select("activity_type, city")
        .eq("user_id", user.id)
        .is("activity_id", null)
        .gt("expires_at", new Date().toISOString());

      // Check unread for each carousel join
      for (const join of carouselJoins || []) {
        const { data: readStatus } = await supabase
          .from("activity_read_status")
          .select("last_read_at")
          .eq("user_id", user.id)
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .maybeSingle();

        const lastReadAt = readStatus?.last_read_at || todayStart.toISOString();

        const { count } = await supabase
          .from("activity_messages")
          .select("*", { count: "exact", head: true })
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .gt("created_at", lastReadAt)
          .neq("user_id", user.id);

        total += count || 0;
      }

      // Get user's plan joins
      const { data: planJoins } = await supabase
        .from("activity_joins")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("activity_id", "is", null)
        .gt("expires_at", new Date().toISOString());

      const joinedPlanIds = (planJoins || []).map(j => j.activity_id).filter(Boolean) as string[];

      // Get user's own plans
      const { data: userPlans } = await supabase
        .from("user_activities")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("scheduled_for", todayStart.toISOString());

      // Combine all plan IDs
      const allPlanIds = new Set([...joinedPlanIds, ...(userPlans || []).map(p => p.id)]);

      // Check unread for each plan
      for (const planId of allPlanIds) {
        const { data: planReadStatus } = await supabase
          .from("activity_read_status")
          .select("last_read_at")
          .eq("user_id", user.id)
          .eq("activity_type", planId)
          .maybeSingle();

        const plan = userPlans?.find(p => p.id === planId);
        const lastPlanRead = planReadStatus?.last_read_at || plan?.created_at || todayStart.toISOString();

        const { count } = await supabase
          .from("plan_messages")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", planId)
          .gt("created_at", lastPlanRead)
          .neq("user_id", user.id);

        total += count || 0;
      }

      // Event group chats (Ticketmaster / route id on `event_chat_members.event_id`)
      let eventMembers: {
        event_id: string | null;
        joined_at: string | null;
        expires_at: string | null;
        paid_at: string | null;
        event_starts_at: string | null;
      }[] = [];
      try {
        if (!user?.id) return;
        const {
          data,
          error: eventMembersError,
          status: eventMembersStatus,
        } = await supabase
          .from("event_chat_members")
          .select("event_id, joined_at, expires_at, paid_at, event_starts_at")
          .eq("user_id", user.id);

        if (!eventMembersError && data) {
          eventMembers = data;
        } else if (eventMembersError && eventMembersStatus !== 400) {
          console.warn("[useTotalUnreadChats] event_chat_members query failed", eventMembersError.message);
        }
      } catch {
        // Silently continue with zero event unreads.
      }

      const activeEventRows = (eventMembers ?? []).filter(
        (m) => m.event_id && !isEventChatMembershipExplicitlyExpired(m),
      );

      const uniqueByEventId = new Map<string, (typeof activeEventRows)[0]>();
      for (const m of activeEventRows) {
        const eid = m.event_id as string;
        if (!uniqueByEventId.has(eid)) uniqueByEventId.set(eid, m);
      }
      const dedupedEventMembers = Array.from(uniqueByEventId.values());

      if (dedupedEventMembers.length > 0) {
        const eventIds = dedupedEventMembers.map((m) => m.event_id as string);
        const { data: chatRows } = await supabase.from("event_chats").select("id, event_id").in("event_id", eventIds);

        const lastSeenMap = readEventChatLastSeenMap();

        const eventUnread = await Promise.all(
          dedupedEventMembers.map(async (m) => {
            const event_id = m.event_id as string;
            const chat = chatRows?.find((c) => c.event_id === event_id);
            if (!chat?.id) return 0;

            const stored = lastSeenMap[event_id]?.trim();
            const joined = typeof m.joined_at === "string" ? m.joined_at.trim() : "";
            const lastSeen = stored || joined || new Date(0).toISOString();

            const { count, error } = await supabase
              .from("event_chat_messages")
              .select("*", { count: "exact", head: true })
              .eq("event_chat_id", chat.id)
              .gt("created_at", lastSeen)
              .neq("user_id", user.id);

            if (error) {
              console.warn("[useTotalUnreadChats] event_chat_messages count failed", error.message);
              return 0;
            }
            return count ?? 0;
          }),
        );

        for (const n of eventUnread) total += n;
      }

      setTotalUnread(total);
    } catch (error) {
      console.error("Error checking unread messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial check
  useEffect(() => {
    checkUnreadMessages();
  }, [checkUnreadMessages]);

  // Subscribe to new messages for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("total-unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_messages" },
        (payload) => {
          const newMessage = payload.new as { user_id: string };
          if (newMessage.user_id !== user.id) {
            checkUnreadMessages();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plan_messages" },
        (payload) => {
          const newMessage = payload.new as { user_id: string };
          if (newMessage.user_id !== user.id) {
            checkUnreadMessages();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_read_status", filter: `user_id=eq.${user.id}` },
        () => {
          checkUnreadMessages();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_chat_messages" },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id !== user.id) checkUnreadMessages();
        }
      )
      .subscribe();

    const onEventChatViewed = () => {
      void checkUnreadMessages();
    };
    window.addEventListener(EVENT_CHAT_VIEWED_EVENT, onEventChatViewed);

    return () => {
      window.removeEventListener(EVENT_CHAT_VIEWED_EVENT, onEventChatViewed);
      supabase.removeChannel(channel);
    };
  }, [user, checkUnreadMessages]);

  return { totalUnread, isLoading, refresh: checkUnreadMessages };
}
