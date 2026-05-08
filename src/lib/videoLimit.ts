import { supabase } from "@/integrations/supabase/client";

export const FREE_MONTHLY_VIDEO_LIMIT = 2;

/**
 * Returns how many videos a free user has uploaded/sent this calendar month
 * (status videos + event chat videos combined) and whether the limit is reached.
 *
 * Premium users should skip this check entirely — call it only when !isPremium.
 */
export async function checkMonthlyVideoLimit(
  userId: string
): Promise<{ count: number; limitReached: boolean }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ count: statusCount }, { count: chatCount }] = await Promise.all([
    supabase
      .from("status_videos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart),
    supabase
      .from("event_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("message_type", "video")
      .gte("created_at", monthStart),
  ]);

  const count = (statusCount ?? 0) + (chatCount ?? 0);
  return { count, limitReached: count >= FREE_MONTHLY_VIDEO_LIMIT };
}
