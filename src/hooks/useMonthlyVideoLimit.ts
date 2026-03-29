import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks how many videos a user has sent/uploaded this calendar month.
 * Covers both event chat videos and status videos combined.
 * Free users are allowed 1 video total per month across both.
 */
export function useMonthlyVideoLimit(userId: string | undefined) {
  const [monthlyVideoCount, setMonthlyVideoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchCount = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count: chatVideoCount } = await supabase
        .from("event_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("message_type", "video")
        .gte("created_at", monthStart);

      const { count: statusVideoCount } = await supabase
        .from("status_videos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart);

      setMonthlyVideoCount((chatVideoCount ?? 0) + (statusVideoCount ?? 0));
      setLoading(false);
    };

    fetchCount();
  }, [userId]);

  const canSendFreeVideo = monthlyVideoCount < 1;

  return { monthlyVideoCount, canSendFreeVideo, loading };
}
