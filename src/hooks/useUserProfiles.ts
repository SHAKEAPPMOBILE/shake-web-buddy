import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

export function useUserProfiles(userIds: string[]) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (userIds.length === 0) return;

      // Filter out already fetched profiles
      const newUserIds = userIds.filter((id) => !profiles[id]);
      if (newUserIds.length === 0) return;

      setIsLoading(true);

      // Fetch profiles using service role or public view
      // Since profiles table has RLS, we need to use a different approach
      // We'll create individual queries for each user
      const fetchedProfiles: Record<string, UserProfile> = {};

      for (const userId of newUserIds) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("user_id, name, avatar_url")
            .eq("user_id", userId)
            .maybeSingle();

          if (data) {
            fetchedProfiles[userId] = data;
          }
        } catch (error) {
          // User profile not found or access denied
          fetchedProfiles[userId] = {
            user_id: userId,
            name: null,
            avatar_url: null,
          };
        }
      }

      setProfiles((prev) => ({ ...prev, ...fetchedProfiles }));
      setIsLoading(false);
    };

    fetchProfiles();
  }, [userIds.join(",")]);

  return { profiles, isLoading };
}
