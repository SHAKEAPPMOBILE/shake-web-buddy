import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useBlockedUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: blockedIds = [], isLoading } = useQuery({
    queryKey: ["user-blocks", user?.id ?? ""],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.blocked_id);
    },
    enabled: !!user?.id,
  });

  const blockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (blockedId === user.id) throw new Error("Cannot block yourself");
      const { error } = await supabase.from("user_blocks").insert({
        blocker_id: user.id,
        blocked_id: blockedId,
      });
      if (error) throw error;
    },
    onSuccess: (_, blockedId) => {
      queryClient.setQueryData<string[]>(
        ["user-blocks", user?.id ?? ""],
        (prev) => (prev ? [...prev, blockedId] : [blockedId])
      );
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["greetings"] });
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: (_, blockedId) => {
      queryClient.setQueryData<string[]>(
        ["user-blocks", user?.id ?? ""],
        (prev) => (prev ? prev.filter((id) => id !== blockedId) : [])
      );
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["greetings"] });
    },
  });

  return {
    blockedUserIds: blockedIds,
    isLoading,
    blockUser: blockUser.mutateAsync,
    unblockUser: unblockUser.mutateAsync,
    isBlocking: blockUser.isPending,
  };
}
