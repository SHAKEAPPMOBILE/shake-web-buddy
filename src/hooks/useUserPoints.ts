import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserPoints(userId: string | undefined) {
  const [points, setPoints] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    if (!userId) {
      setPoints(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc("get_user_points", { target_user_id: userId });

      if (error) {
        console.error("Error fetching user points:", error);
        setPoints(0);
      } else {
        setPoints(data || 0);
      }
    } catch (error) {
      console.error("Error fetching user points:", error);
      setPoints(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Subscribe to realtime updates for check-ins
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`check_ins_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "check_ins",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchPoints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPoints]);

  return { points, isLoading, refetch: fetchPoints };
}
