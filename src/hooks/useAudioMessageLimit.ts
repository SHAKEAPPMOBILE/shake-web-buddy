import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FREE_AUDIO_LIMIT = 10;

interface UseAudioMessageLimitProps {
  conversationType: 'private' | 'activity' | 'plan';
  conversationId: string; // For private: otherUserId, for activity: `${city}-${activityType}`, for plan: activityId
}

export function useAudioMessageLimit({ conversationType, conversationId }: UseAudioMessageLimitProps) {
  const { user, isPremium } = useAuth();
  const [audioCount, setAudioCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAudioCount = useCallback(async () => {
    if (!user || isPremium) {
      setAudioCount(0);
      setIsLoading(false);
      return;
    }

    try {
      let count = 0;

      if (conversationType === 'private') {
        // Count audio messages in private conversation
        const { count: msgCount, error } = await supabase
          .from("private_messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", user.id)
          .eq("receiver_id", conversationId)
          .not("audio_url", "is", null);
        
        if (!error) count = msgCount || 0;
      } else if (conversationType === 'activity') {
        // Parse city and activity type from conversationId
        const [city, activityType] = conversationId.split('::');
        
        // Count audio messages in activity chat (today only)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: msgCount, error } = await supabase
          .from("activity_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("city", city)
          .eq("activity_type", activityType)
          .not("audio_url", "is", null)
          .gte("created_at", today.toISOString());
        
        if (!error) count = msgCount || 0;
      } else if (conversationType === 'plan') {
        // Count audio messages in plan chat
        const { count: msgCount, error } = await supabase
          .from("plan_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("activity_id", conversationId)
          .not("audio_url", "is", null);
        
        if (!error) count = msgCount || 0;
      }

      setAudioCount(count);
    } catch (error) {
      console.error("Error fetching audio count:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isPremium, conversationType, conversationId]);

  useEffect(() => {
    fetchAudioCount();
  }, [fetchAudioCount]);

  const incrementAudioCount = useCallback(() => {
    setAudioCount(prev => prev + 1);
  }, []);

  const canSendAudio = isPremium || audioCount < FREE_AUDIO_LIMIT;
  const remainingAudio = FREE_AUDIO_LIMIT - audioCount;

  return {
    audioCount,
    canSendAudio,
    remainingAudio,
    isLoading,
    incrementAudioCount,
    refreshCount: fetchAudioCount,
    FREE_AUDIO_LIMIT,
  };
}
