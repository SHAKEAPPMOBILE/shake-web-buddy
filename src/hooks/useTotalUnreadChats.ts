import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTotalUnreadChats() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const checkUnreadMessages = useCallback(async () => {
    if (!user) {
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
    if (!user) return;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkUnreadMessages]);

  return { totalUnread, isLoading, refresh: checkUnreadMessages };
}
