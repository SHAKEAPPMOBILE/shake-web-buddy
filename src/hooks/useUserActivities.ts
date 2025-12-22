import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
}

const MAX_ACTIVITIES_PER_MONTH = 10;

export function useUserActivities(city: string) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [myActivities, setMyActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activitiesThisMonth, setActivitiesThisMonth] = useState(0);

  // Fetch all active activities for the city
  const fetchActivities = useCallback(async () => {
    if (!city) return;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_activities")
      .select("*")
      .eq("city", city)
      .eq("is_active", true)
      .gt("scheduled_for", now)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error fetching activities:", error);
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
          .single();

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
  }, [city]);

  // Fetch user's own activities
  const fetchMyActivities = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error fetching my activities:", error);
      return;
    }

    setMyActivities(data || []);
  }, [user]);

  // Check how many activities user has created this month
  const fetchMonthlyCount = useCallback(async () => {
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const { count, error } = await supabase
      .from("user_activities")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString())
      .lt("created_at", endOfMonth.toISOString());

    if (error) {
      console.error("Error fetching monthly count:", error);
      return;
    }

    setActivitiesThisMonth(count || 0);
  }, [user]);

  // Create a new activity
  const createActivity = async (
    activityType: string,
    scheduledFor: Date
  ): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to create an activity");
      return false;
    }

    if (activitiesThisMonth >= MAX_ACTIVITIES_PER_MONTH) {
      toast.error(`You can only create ${MAX_ACTIVITIES_PER_MONTH} activities per month`);
      return false;
    }

    setIsLoading(true);

    const { error } = await supabase.from("user_activities").insert({
      user_id: user.id,
      activity_type: activityType,
      city: city,
      scheduled_for: scheduledFor.toISOString(),
    });

    if (error) {
      console.error("Error creating activity:", error);
      if (error.message.includes("row-level security")) {
        toast.error(`You've reached your limit of ${MAX_ACTIVITIES_PER_MONTH} activities this month`);
      } else {
        toast.error("Failed to create activity");
      }
      setIsLoading(false);
      return false;
    }

    toast.success("Activity created!");
    await Promise.all([fetchActivities(), fetchMyActivities(), fetchMonthlyCount()]);
    setIsLoading(false);
    return true;
  };

  // Update an activity
  const updateActivity = async (
    activityId: string,
    updates: { activity_type?: string; scheduled_for?: Date }
  ): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);

    const updateData: Record<string, unknown> = {};
    if (updates.activity_type) updateData.activity_type = updates.activity_type;
    if (updates.scheduled_for) updateData.scheduled_for = updates.scheduled_for.toISOString();

    const { error } = await supabase
      .from("user_activities")
      .update(updateData)
      .eq("id", activityId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating activity:", error);
      toast.error("Failed to update activity");
      setIsLoading(false);
      return false;
    }

    toast.success("Activity updated!");
    await Promise.all([fetchActivities(), fetchMyActivities()]);
    setIsLoading(false);
    return true;
  };

  // Delete/cancel an activity
  const deleteActivity = async (activityId: string): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);

    const { error } = await supabase
      .from("user_activities")
      .delete()
      .eq("id", activityId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting activity:", error);
      toast.error("Failed to delete activity");
      setIsLoading(false);
      return false;
    }

    toast.success("Activity cancelled");
    await Promise.all([fetchActivities(), fetchMyActivities(), fetchMonthlyCount()]);
    setIsLoading(false);
    return true;
  };

  // Join an activity
  const joinActivity = async (activityId: string): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      return false;
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from("activity_joins")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      toast.info("You've already joined this activity!");
      return false;
    }

    // Get activity details for the join
    const activity = activities.find(a => a.id === activityId);
    if (!activity) {
      toast.error("Activity not found");
      return false;
    }

    const { error } = await supabase.from("activity_joins").insert({
      user_id: user.id,
      activity_id: activityId,
      activity_type: activity.activity_type,
      city: city,
    });

    if (error) {
      console.error("Error joining activity:", error);
      toast.error("Failed to join activity");
      return false;
    }

    toast.success("You've joined the activity!");
    await fetchActivities();
    return true;
  };

  // Leave an activity
  const leaveActivity = async (activityId: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from("activity_joins")
      .delete()
      .eq("activity_id", activityId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error leaving activity:", error);
      toast.error("Failed to leave activity");
      return false;
    }

    toast.success("You've left the activity");
    await fetchActivities();
    return true;
  };

  // Check if user has joined a specific activity
  const hasJoinedActivity = useCallback(async (activityId: string): Promise<boolean> => {
    if (!user) return false;

    const { data } = await supabase
      .from("activity_joins")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .single();

    return !!data;
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!city) return;

    fetchActivities();
    fetchMyActivities();
    fetchMonthlyCount();

    const channel = supabase
      .channel(`user-activities-${city}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_activities",
          filter: `city=eq.${city}`,
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
  }, [city, user?.id, fetchActivities, fetchMyActivities, fetchMonthlyCount]);

  return {
    activities,
    myActivities,
    isLoading,
    activitiesThisMonth,
    remainingActivities: MAX_ACTIVITIES_PER_MONTH - activitiesThisMonth,
    createActivity,
    updateActivity,
    deleteActivity,
    joinActivity,
    leaveActivity,
    hasJoinedActivity,
    fetchActivities,
  };
}
