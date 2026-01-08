import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FREE_CHARACTER_LIMIT = 100000;

export function useTextMessageLimit() {
  const { user, isPremium } = useAuth();
  const [characterCount, setCharacterCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCharacterCount = useCallback(async () => {
    if (!user || isPremium) {
      setCharacterCount(0);
      setIsLoading(false);
      return;
    }

    try {
      // Count characters from activity_messages (excluding audio-only messages)
      const { data: activityMessages, error: activityError } = await supabase
        .from("activity_messages")
        .select("message")
        .eq("user_id", user.id)
        .is("audio_url", null);

      // Count characters from plan_messages (excluding audio-only messages)
      const { data: planMessages, error: planError } = await supabase
        .from("plan_messages")
        .select("message")
        .eq("user_id", user.id)
        .is("audio_url", null);

      // Count characters from private_messages (excluding audio-only messages)
      const { data: privateMessages, error: privateError } = await supabase
        .from("private_messages")
        .select("message")
        .eq("sender_id", user.id)
        .is("audio_url", null);

      if (activityError || planError || privateError) {
        console.error("Error fetching character count:", activityError || planError || privateError);
        setIsLoading(false);
        return;
      }

      // Calculate total characters (excluding voice note placeholders)
      let totalChars = 0;
      
      const voiceNotePlaceholder = "🎤 Voice note";
      
      activityMessages?.forEach((msg) => {
        if (msg.message !== voiceNotePlaceholder) {
          totalChars += msg.message.length;
        }
      });
      
      planMessages?.forEach((msg) => {
        if (msg.message !== voiceNotePlaceholder) {
          totalChars += msg.message.length;
        }
      });
      
      privateMessages?.forEach((msg) => {
        if (msg.message !== voiceNotePlaceholder) {
          totalChars += msg.message.length;
        }
      });

      setCharacterCount(totalChars);
    } catch (error) {
      console.error("Error fetching character count:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isPremium]);

  useEffect(() => {
    fetchCharacterCount();
  }, [fetchCharacterCount]);

  const addCharacters = useCallback((chars: number) => {
    setCharacterCount(prev => prev + chars);
  }, []);

  const canSendText = isPremium || characterCount < FREE_CHARACTER_LIMIT;
  const remainingCharacters = Math.max(0, FREE_CHARACTER_LIMIT - characterCount);
  const usagePercentage = Math.min(100, (characterCount / FREE_CHARACTER_LIMIT) * 100);

  return {
    characterCount,
    canSendText,
    remainingCharacters,
    usagePercentage,
    isLoading,
    addCharacters,
    refreshCount: fetchCharacterCount,
    FREE_CHARACTER_LIMIT,
  };
}
