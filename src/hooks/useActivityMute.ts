import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActivityMute(city: string, activityType: string) {
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch mute status
  useEffect(() => {
    if (!user || !city || !activityType) return;

    const fetchMuteStatus = async () => {
      const { data, error } = await supabase
        .from("activity_read_status")
        .select("muted")
        .eq("user_id", user.id)
        .eq("city", city)
        .eq("activity_type", activityType)
        .maybeSingle();

      if (!error && data) {
        setIsMuted(data.muted);
      }
    };

    fetchMuteStatus();
  }, [user, city, activityType]);

  // Toggle mute status
  const toggleMute = async (): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    const newMutedStatus = !isMuted;

    // Upsert the mute status
    const { error } = await supabase
      .from("activity_read_status")
      .upsert(
        {
          user_id: user.id,
          city,
          activity_type: activityType,
          muted: newMutedStatus,
          last_read_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,city,activity_type",
        }
      );

    if (error) {
      console.error("Error toggling mute:", error);
      setIsLoading(false);
      return false;
    }

    setIsMuted(newMutedStatus);
    setIsLoading(false);
    return true;
  };

  return {
    isMuted,
    isLoading,
    toggleMute,
  };
}
