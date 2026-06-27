import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { getNextOccurrenceDate } from "@/data/activityTypes";
import { findOrCreateOpenGroup } from "@/lib/activityGroups";

interface ActivityJoin {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  joined_at: string;
  expires_at: string;
}

export function useActivityJoins(city: string) {
  const { user } = useAuth();
  const [activeJoins, setActiveJoins] = useState<ActivityJoin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch active joins for the current city
  const fetchActiveJoins = async () => {
    const { data, error } = await supabase
      .from("activity_joins")
      .select("*")
      .eq("city", city)
      .gt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Error fetching activity joins:", error);
      return;
    }

    setActiveJoins(data || []);
  };

  // Join an activity - returns { success: boolean, isNewJoin: boolean }
  // Optional cityOverride allows joining in a different city (for premium users)
  // NOTE: Joining an existing activity has NO plan limit check — it is always free.
  // Plan limits only apply when CREATING a new plan (propose-plan flow).
  const joinActivity = async (activityType: string, cityOverride?: string): Promise<{ success: boolean; isNewJoin: boolean }> => {
    const targetCity = cityOverride || city;

    // JOIN PATH — no plan count check. Joining is always free and unlimited.
    console.log('[Join] useActivityJoins.joinActivity — JOIN path, no plan limit', {
      activityType,
      targetCity,
      userId: user?.id,
    });

    if (!user) {
      toast.error("Please sign in to join an activity");
      return { success: false, isNewJoin: false };
    }

    setIsLoading(true);

    const existingJoin = activeJoins.find(
      (join) => join.user_id === user.id && join.activity_type === activityType
    );

    if (existingJoin) {
      toast.info("You've already joined this activity today!");
      setIsLoading(false);
      return { success: true, isNewJoin: false };
    }

    // Check if user already joined this activity type in any city
    const { data: existingJoins, error: checkError } = await supabase
      .from("activity_joins")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_type", activityType)
      .gt("expires_at", new Date().toISOString());

    if (checkError) {
      console.error("Error checking existing joins:", checkError);
      setIsLoading(false);
      return { success: false, isNewJoin: false };
    }

    if (existingJoins && existingJoins.length > 0) {
      toast.info("You've already joined this activity today!");
      setIsLoading(false);
      return { success: true, isNewJoin: false }; // Already joined, no animation
    }

    // Insert new join — expires 24 h after end of the activity's scheduled day
    // (end of activity day + 24 h = end of the following day, keeping the chat alive
    //  for a full day after the activity finishes)
    const nextOccurrence = getNextOccurrenceDate(activityType);
    nextOccurrence.setDate(nextOccurrence.getDate() + 1); // day after the activity
    nextOccurrence.setUTCHours(23, 59, 59, 999);
    const expiresAt = nextOccurrence.toISOString();

    // Route through the shared clustering function — same logic as My City cards.
    // Finds an open group (< MAX_GROUP_CAPACITY active joins) or creates a new
    // overflow group with group_number = max + 1, is_auto_generated = true.
    const openGroup = await findOrCreateOpenGroup(activityType, targetCity, user.id);
    const uaId = openGroup?.id ?? null;

    const { error: insertError } = await supabase
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_type: activityType,
        city: targetCity,
        expires_at: expiresAt,
        activity_id: uaId,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        toast.info("You've already joined this activity today!");
        setIsLoading(false);
        return { success: true, isNewJoin: false };
      }

      console.error("Error joining activity:", insertError);
      toast.error("Failed to join activity");
      setIsLoading(false);
      return { success: false, isNewJoin: false };
    }

    toast.success("You've joined the activity!");

    // Get user name for notifications
    const userName = user.user_metadata?.name || user.email?.split('@')[0] || "Someone";
    
    // Send two types of SMS notifications (fire and forget):
    // 1. Daily city SMS - first join of the day notifies all users in the city
    // 2. Activity-specific SMS - notifies users already in the same activity
    
    // First: Try to send daily city SMS (only succeeds if first join of the day)
    supabase.functions.invoke('send-daily-city-sms', {
      body: {
        notificationType: 'first_activity_join',
        city: targetCity,
        triggerUserName: userName,
        activityType,
      }
    }).then(({ data, error }) => {
      if (error) {
        console.error("Failed to send daily city SMS:", error);
      } else {
        console.log("Daily city SMS result:", data);
      }
    });
    
    // Second: Send SMS to users already in the same specific activity
    supabase.functions.invoke('send-sms-notification', {
      body: {
        activityType,
        city: targetCity,
        joinerName: userName,
        joinerUserId: user.id,
      }
    }).then(({ error }) => {
      if (error) {
        console.error("Failed to send activity SMS notifications:", error);
      } else {
        console.log("Activity SMS notifications sent");
      }
    });
    
    await fetchActiveJoins();
    setIsLoading(false);
    return { success: true, isNewJoin: true }; // New join, show animation
  };

  // Leave/cancel an activity
  const leaveActivity = async (activityType: string): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to leave an activity");
      return false;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("activity_joins")
      .delete()
      .eq("user_id", user.id)
      .eq("activity_type", activityType)
      .eq("city", city);

    if (error) {
      console.error("Error leaving activity:", error);
      toast.error("Failed to leave activity");
      setIsLoading(false);
      return false;
    }

    toast.success("You've left the activity");
    await fetchActiveJoins();
    setIsLoading(false);
    return true;
  };

  // Get count of unique users who joined a specific activity today
  const getActivityJoinCount = (activityType: string): number => {
    const uniqueUsers = new Set(
      activeJoins
        .filter(join => join.activity_type === activityType)
        .map(join => join.user_id)
    );
    return uniqueUsers.size;
  };

  // Check if current user has joined a specific activity
  const hasUserJoined = (activityType: string): boolean => {
    if (!user) return false;
    return activeJoins.some(
      join => join.activity_type === activityType && join.user_id === user.id
    );
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!city) return;

    fetchActiveJoins();

    // Use a unique channel name per city to avoid cross-city notifications
    const channelName = `activity-joins-${city.replace(/\s+/g, '-').toLowerCase()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_joins',
          filter: `city=eq.${city}`,
        },
        (payload) => {
          const newJoin = payload.new as ActivityJoin;
          // Double-check city match and exclude own joins
          if (newJoin.city === city && newJoin.user_id !== user?.id) {
            toast.info(`Someone just joined ${newJoin.activity_type}! 🎉`);
            fetchActiveJoins();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activity_joins',
          filter: `city=eq.${city}`,
        },
        () => {
          // Refresh local cache so hasUserJoined() stays accurate after any leave,
          // including leaves performed from PlansTab (a separate useActivityJoins instance).
          fetchActiveJoins();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [city, user?.id]);

  return {
    activeJoins,
    isLoading,
    joinActivity,
    leaveActivity,
    getActivityJoinCount,
    hasUserJoined,
    fetchActiveJoins,
  };
}
