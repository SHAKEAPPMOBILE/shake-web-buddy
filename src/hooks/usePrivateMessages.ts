import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  audio_url: string | null;
  created_at: string;
  read_at: string | null;
}

export function usePrivateMessages(otherUserId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user || !otherUserId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("private_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching private messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, otherUserId]);

  // Send a message
  const sendMessage = async (message: string, audioUrl?: string) => {
    if (!user || !otherUserId) return { error: new Error("Not authenticated") };

    const { error } = await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      message,
      audio_url: audioUrl || null,
    });

    if (!error) {
      await fetchMessages();
    }

    return { error };
  };

  // Mark messages as read
  const markAsRead = async () => {
    if (!user || !otherUserId) return;

    await supabase
      .from("private_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherUserId)
      .eq("receiver_id", user.id)
      .is("read_at", null);
  };

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !otherUserId) return;

    const channel = supabase
      .channel(`private-messages-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
        },
        (payload) => {
          const newMessage = payload.new as PrivateMessage;
          // Only add if relevant to this conversation
          if (
            (newMessage.sender_id === user.id && newMessage.receiver_id === otherUserId) ||
            (newMessage.sender_id === otherUserId && newMessage.receiver_id === user.id)
          ) {
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId]);

  return {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
    refreshMessages: fetchMessages,
  };
}
