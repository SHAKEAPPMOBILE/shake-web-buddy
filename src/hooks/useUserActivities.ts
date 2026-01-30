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
  note?: string | null;
  price_amount?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
}

// Dynamic limits - set by database function based on signup date
const DEFAULT_FIRST_MONTH_LIMIT = 3; // First 30 days after signup
const DEFAULT_REGULAR_LIMIT = 2; // After first month
const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function useUserActivities(city: string) {
  const { user, isPremium } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [myActivities, setMyActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activitiesThisMonth, setActivitiesThisMonth] = useState(0);
  const [maxActivitiesLimit, setMaxActivitiesLimit] = useState(DEFAULT_REGULAR_LIMIT);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch all active activities for the city
  const fetchActivities = useCallback(async () => {
    if (!city) return;

    // Show activities from the past week (so anyone can join for 1 week after creation)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from("user_activities")
      .select("*")
      .eq("city", city)
      .eq("is_active", true)
      .gte("scheduled_for", oneWeekAgo.toISOString())
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

  // Check how many activities user has created this month that count toward the limit
  // Activities only count if they've been online for 6+ hours before being deleted
  const fetchMonthlyCount = useCallback(async () => {
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    // Get all activities created this month (both active and deleted/inactive)
    const { data, error } = await supabase
      .from("user_activities")
      .select("id, created_at, is_active")
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString())
      .lt("created_at", endOfMonth.toISOString());

    if (error) {
      console.error("Error fetching monthly count:", error);
      return;
    }

    // Count activities that are either:
    // 1. Still active (is_active = true), OR
    // 2. Were online for at least 6 hours (created more than 6 hours ago)
    const now = Date.now();
    const countedActivities = (data || []).filter(activity => {
      if (activity.is_active) return true; // Active activities always count
      
      // For inactive/deleted activities, check if they were online for 6+ hours
      const createdAt = new Date(activity.created_at).getTime();
      const wasOnlineFor6Hours = (now - createdAt) >= SIX_HOURS_MS;
      return wasOnlineFor6Hours;
    });

    setActivitiesThisMonth(countedActivities.length);
  }, [user]);

  // Fetch the user's activity limit based on signup date
  const fetchActivityLimit = useCallback(async () => {
    if (!user) return;

    // Call the database function to get the dynamic limit
    const { data, error } = await supabase.rpc('get_user_activity_limit', {
      target_user_id: user.id
    });

    if (error) {
      console.error("Error fetching activity limit:", error);
      return;
    }

    // Premium users get a very high number, others get their actual limit
    if (data && data < 999999) {
      setMaxActivitiesLimit(data);
    }
  }, [user]);

  // Create a new activity
  const createActivity = async (
    activityType: string,
    scheduledFor: Date,
    note?: string,
    cityOverride?: string,
    priceAmount?: string
  ): Promise<boolean> => {
    const targetCity = cityOverride || city;
    if (!user) {
      toast.error("Please sign in to create an activity");
      return false;
    }

    // Premium users have unlimited activities
    if (!isPremium && activitiesThisMonth >= maxActivitiesLimit) {
      toast.error(`You can only create ${maxActivitiesLimit} activities per month`);
      return false;
    }

    setIsLoading(true);

    // Check for ANY existing activity on the same day (one activity per day limit)
    const startOfDay = new Date(scheduledFor);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledFor);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingActivity } = await supabase
      .from("user_activities")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gte("scheduled_for", startOfDay.toISOString())
      .lte("scheduled_for", endOfDay.toISOString())
      .maybeSingle();

    if (existingActivity) {
      setIsLoading(false);
      return false;
    }

    const { data: newActivity, error } = await supabase.from("user_activities").insert({
      user_id: user.id,
      activity_type: activityType,
      city: targetCity,
      scheduled_for: scheduledFor.toISOString(),
      note: note?.trim() || null,
      price_amount: priceAmount || null,
    }).select().maybeSingle();

    if (error || !newActivity) {
      console.error("Error creating activity:", error);
      if (error?.message.includes("row-level security")) {
        toast.error(`You've reached your limit of ${maxActivitiesLimit} activities this month`);
      } else {
        toast.error("Failed to create activity");
      }
      setIsLoading(false);
      return false;
    }

    // Also add creator to activity_joins so they appear in Plans list
    await supabase.from("activity_joins").insert({
      user_id: user.id,
      activity_id: newActivity.id,
      activity_type: activityType,
      city: targetCity,
    });

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
  const joinActivity = async (
    activityId: string,
    isPremium: boolean
  ): Promise<{ success: boolean; requiresPremium?: boolean; requiresPayment?: boolean; priceAmount?: string }> => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      return { success: false };
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from("activity_joins")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      toast.info("You've already joined this activity!");
      return { success: false };
    }

    // Fetch activity details directly from database (not from local state which is city-filtered)
    const { data: activity, error: fetchError } = await supabase
      .from("user_activities")
      .select("*")
      .eq("id", activityId)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError || !activity) {
      console.error("Error fetching activity:", fetchError);
      toast.error("Activity not found");
      return { success: false };
    }

    // Check if activity has a price - require payment first
    // Don't allow join for paid activities - redirect to payment instead
    if (activity.price_amount && activity.user_id !== user.id) {
      return { 
        success: false, 
        requiresPayment: true, 
        priceAmount: activity.price_amount 
      };
    }

    // Cross-city join is premium. If frontend premium state is stale, double-check backend override.
    if (activity.city !== city && !isPremium) {
      const { data: privateProfile } = await supabase
        .from("profiles_private")
        .select("premium_override")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!privateProfile?.premium_override) {
        return { success: false, requiresPremium: true };
      }
    }

    const { error } = await supabase.from("activity_joins").insert({
      user_id: user.id,
      activity_id: activityId,
      activity_type: activity.activity_type,
      city: activity.city,
    });

    if (error) {
      console.error("Error joining activity:", error);
      toast.error("Failed to join activity");
      return { success: false };
    }

    // Get user's name for SMS notification
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Send SMS notification to activity creator
    try {
      await supabase.functions.invoke("send-plan-sms", {
        body: {
          notificationType: "plan_join",
          activityId: activityId,
          senderName: profile?.name || "Someone",
        },
      });
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
      // Don't fail the join if SMS fails
    }

    toast.success("You've joined the activity!");
    await fetchActivities();
    return { success: true };
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
      .maybeSingle();

    return !!data;
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!city) return;

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchActivities(), fetchMyActivities(), fetchMonthlyCount(), fetchActivityLimit()]);
      setIsLoading(false);
      setHasFetched(true);
    };

    loadData();

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
  }, [city, user?.id, fetchActivities, fetchMyActivities, fetchMonthlyCount, fetchActivityLimit]);

  return {
    activities,
    myActivities,
    isLoading,
    activitiesThisMonth,
    remainingActivities: isPremium ? Infinity : Math.max(0, maxActivitiesLimit - activitiesThisMonth),
    maxActivitiesLimit,
    createActivity,
    updateActivity,
    deleteActivity,
    joinActivity,
    leaveActivity,
    hasJoinedActivity,
    fetchActivities,
    fetchMyActivities,
  };
}
