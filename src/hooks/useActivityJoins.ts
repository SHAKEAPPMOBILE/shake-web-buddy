import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const joinActivity = async (activityType: string): Promise<{ success: boolean; isNewJoin: boolean }> => {
    if (!user) {
      toast.error("Please sign in to join an activity");
      return { success: false, isNewJoin: false };
    }

    setIsLoading(true);

    // Check if user already joined this activity type in this city
    const { data: existingJoins, error: checkError } = await supabase
      .from("activity_joins")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_type", activityType)
      .eq("city", city)
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

    // Insert new join
    const { error: insertError } = await supabase
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_type: activityType,
        city: city,
      });

    if (insertError) {
      console.error("Error joining activity:", insertError);
      toast.error("Failed to join activity");
      setIsLoading(false);
      return { success: false, isNewJoin: false };
    }

    toast.success("You've joined the activity!");
    
    // Send SMS notifications to other users in the same activity (fire and forget)
    const userName = user.user_metadata?.name || user.email?.split('@')[0] || "Someone";
    supabase.functions.invoke('send-sms-notification', {
      body: {
        activityType,
        city,
        joinerName: userName,
        joinerUserId: user.id,
      }
    }).then(({ error }) => {
      if (error) {
        console.error("Failed to send SMS notifications:", error);
      } else {
        console.log("SMS notifications sent");
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
