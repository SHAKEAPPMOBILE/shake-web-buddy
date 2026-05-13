import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type?: string | null;
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
  const sendMessage = async (message: string, messageType: "text" | "gif" | "image" | "video" = "text") => {
    if (!user || !otherUserId) return { error: new Error("Not authenticated") };

    const trimmed = message.trim();
    if ((messageType === "gif" || messageType === "image" || messageType === "video") && !/^https?:\/\//i.test(trimmed)) {
      return { error: new Error("Invalid media URL") };
    }

    const { error } = await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      message: trimmed,
      message_type: messageType,
    });

    if (!error) {
      await fetchMessages();

      // Fire-and-forget push to recipient
      void (async () => {
        const { data: senderProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
        const senderName = senderProfile?.name || "Someone";
        await supabase.functions.invoke("send-push-notification", {
          body: {
            to_user_id: otherUserId,
            title: `${senderName} sent you a message 💬`,
            body: trimmed.slice(0, 80),
            data: { tab: "chat", other_user_id: user.id },
          },
        });
      })();
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
