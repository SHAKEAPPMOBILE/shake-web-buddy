import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";

interface Greeting {
  id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}

interface GreetingWithProfile extends Greeting {
  from_user: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  to_user: {
    name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useGreetings() {
  const { user } = useAuth();
  const { blockedUserIds } = useBlockedUsers();
  const [sentGreetings, setSentGreetings] = useState<GreetingWithProfile[]>([]);
  const [receivedGreetings, setReceivedGreetings] = useState<GreetingWithProfile[]>([]);
  const [matches, setMatches] = useState<GreetingWithProfile[]>([]);
  const [pendingReceived, setPendingReceived] = useState<GreetingWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGreetings = useCallback(async () => {
    if (!user) {
      setSentGreetings([]);
      setReceivedGreetings([]);
      setMatches([]);
      setPendingReceived([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch greetings I sent
      const { data: sent, error: sentError } = await supabase
        .from("greetings")
        .select("*")
        .eq("from_user_id", user.id);

      if (sentError) throw sentError;

      // Fetch greetings I received
      const { data: received, error: receivedError } = await supabase
        .from("greetings")
        .select("*")
        .eq("to_user_id", user.id);

      if (receivedError) throw receivedError;

      // Get all unique user IDs to fetch profiles
      const userIds = new Set<string>();
      sent?.forEach((g) => userIds.add(g.to_user_id));
      received?.forEach((g) => userIds.add(g.from_user_id));

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, { name: p.name, avatar_url: p.avatar_url }]) || []
      );

      // Enrich greetings with profiles
      const enrichedSent: GreetingWithProfile[] = (sent || []).map((g) => ({
        ...g,
        from_user: null,
        to_user: profileMap.get(g.to_user_id) || null,
      }));

      const enrichedReceived: GreetingWithProfile[] = (received || []).map((g) => ({
        ...g,
        from_user: profileMap.get(g.from_user_id) || null,
        to_user: null,
      }));

      // Exclude blocked users from received/matches/pending (remove from feed instantly)
      const blockedSet = new Set(blockedUserIds);
      const receivedFiltered = enrichedReceived.filter((g) => !blockedSet.has(g.from_user_id));

      setSentGreetings(enrichedSent);
      setReceivedGreetings(receivedFiltered);

      // Calculate matches (mutual greetings)
      const sentToIds = new Set(sent?.map((g) => g.to_user_id) || []);
      const receivedFromIds = new Set(receivedFiltered.map((g) => g.from_user_id));

      const matchedUserIds = [...sentToIds].filter((id) => receivedFromIds.has(id));
      
      const matchedGreetings = receivedFiltered.filter((g) =>
        matchedUserIds.includes(g.from_user_id)
      );
      setMatches(matchedGreetings);

      // Pending received = received but not yet sent back
      const pendingReceivedGreetings = receivedFiltered.filter(
        (g) => !sentToIds.has(g.from_user_id)
      );
      setPendingReceived(pendingReceivedGreetings);
    } catch (error) {
      console.error("Error fetching greetings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, blockedUserIds]);

  // Send a greeting
  const sendGreeting = async (toUserId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase
      .from("greetings")
      .insert({ from_user_id: user.id, to_user_id: toUserId });

    if (!error) {
      await fetchGreetings();
    }

    return { error };
  };

  // Check if I've already sent a greeting to this user
  const hasSentGreeting = (toUserId: string) => {
    return sentGreetings.some((g) => g.to_user_id === toUserId);
  };

  // Check if I've received a greeting from this user
  const hasReceivedGreeting = (fromUserId: string) => {
    return receivedGreetings.some((g) => g.from_user_id === fromUserId);
  };

  // Check if we're matched
  const isMatched = (otherUserId: string) => {
    return matches.some((g) => g.from_user_id === otherUserId);
  };

  // Initial fetch
  useEffect(() => {
    fetchGreetings();
  }, [fetchGreetings]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("greetings-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "greetings",
        },
        (payload) => {
          const newRecord = payload.new as Greeting | null;
          const oldRecord = payload.old as Greeting | null;

          // Only refresh if the change involves the current user
          if (
            newRecord?.from_user_id === user.id ||
            newRecord?.to_user_id === user.id ||
            oldRecord?.from_user_id === user.id ||
            oldRecord?.to_user_id === user.id
          ) {
            fetchGreetings();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchGreetings]);

  return {
    sentGreetings,
    receivedGreetings,
    matches,
    pendingReceived,
    isLoading,
    sendGreeting,
    hasSentGreeting,
    hasReceivedGreeting,
    isMatched,
    refreshGreetings: fetchGreetings,
  };
}
