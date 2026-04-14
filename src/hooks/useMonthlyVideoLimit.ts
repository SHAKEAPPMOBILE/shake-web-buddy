import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks how many videos a user has sent/uploaded all-time.
 * Covers both event chat videos and status videos combined.
 * Free users are allowed 3 videos total across both.
 */
export function useMonthlyVideoLimit(userId: string | undefined) {
  const [totalVideoCount, setTotalVideoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchCount = async () => {
      const { count: chatVideoCount } = await supabase
        .from("event_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("message_type", "video");

      const { count: statusVideoCount } = await supabase
        .from("status_videos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      setTotalVideoCount((chatVideoCount ?? 0) + (statusVideoCount ?? 0));
      setLoading(false);
    };

    fetchCount();
  }, [userId]);

  const canSendFreeVideo = totalVideoCount < 3;

  return { totalVideoCount, canSendFreeVideo, loading };
}
