import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserActivity } from "@/hooks/useUserActivities";

export function useAllActivities() {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_activities")
      .select("*")
      .eq("is_active", true)
      .gt("scheduled_for", now)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error fetching all activities:", error);
      setIsLoading(false);
      return;
    }

    // Fetch creator profiles and participant counts
    const activitiesWithDetails = await Promise.all(
      (data || []).map(async (activity) => {
        // Get creator profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", activity.user_id)
          .maybeSingle();

        // Get participant count
        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", activity.id);

        return {
          ...activity,
          creator_name: profile?.name || "Anonymous",
          creator_avatar: profile?.avatar_url,
          participant_count: (count || 0) + 1, // +1 for creator
        };
      })
    );

    setActivities(activitiesWithDetails);
    setIsLoading(false);
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel("all-user-activities")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_activities",
        },
        () => {
          fetchActivities();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_joins",
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities]);

  return {
    activities,
    isLoading,
    refetch: fetchActivities,
  };
}