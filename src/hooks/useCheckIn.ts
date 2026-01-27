import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";

const POINTS_PER_CHECKIN = 5;

export function useCheckIn() {
  const { user } = useAuth();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<Record<string, boolean>>({});

  const checkIfAlreadyCheckedIn = useCallback(async (activityType: string, city: string) => {
    if (!user) return false;
    
    const key = `${activityType}-${city}`;
    if (hasCheckedInToday[key] !== undefined) {
      return hasCheckedInToday[key];
    }

    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("activity_type", activityType)
      .eq("city", city)
      .eq("check_in_date", today)
      .maybeSingle();

    if (error) {
      console.error("Error checking check-in status:", error);
      return false;
    }

    const alreadyCheckedIn = !!data;
    setHasCheckedInToday(prev => ({ ...prev, [key]: alreadyCheckedIn }));
    return alreadyCheckedIn;
  }, [user, hasCheckedInToday]);

  const checkIn = useCallback(async (
    activityType: string,
    city: string,
    venueName: string
  ): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to check in");
      return false;
    }

    setIsCheckingIn(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from("check_ins")
        .insert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          venue_name: venueName,
          points_earned: POINTS_PER_CHECKIN,
          check_in_date: today,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.info("You've already checked in here today!");
          const key = `${activityType}-${city}`;
          setHasCheckedInToday(prev => ({ ...prev, [key]: true }));
          return false;
        }
        throw error;
      }

      const key = `${activityType}-${city}`;
      setHasCheckedInToday(prev => ({ ...prev, [key]: true }));
      
      toast.success(`+${POINTS_PER_CHECKIN} points! 🎉`, {
        description: `Checked in at ${venueName}`,
      });
      triggerConfettiWaterfall();
      
      return true;
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in. Please try again.");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  }, [user]);

  return {
    checkIn,
    isCheckingIn,
    checkIfAlreadyCheckedIn,
    hasCheckedInToday,
  };
}
