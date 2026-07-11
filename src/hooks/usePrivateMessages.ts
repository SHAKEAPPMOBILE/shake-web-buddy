import { useState, useEffect, useCallback, useRef } from "react";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (id: string | null | undefined): id is string => !!id && UUID_RE.test(id);

export function usePrivateMessages(otherUserId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Ref guard: prevents concurrent sends from firing the insert twice
  const isSendingRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!user || !isValidUuid(otherUserId)) {
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
    if (!user || !isValidUuid(otherUserId)) return { error: new Error("Not authenticated") };
    // Ref guard: bail if a send is already in flight
    if (isSendingRef.current) return { error: null };
    isSendingRef.current = true;

    const trimmed = message.trim();
    if ((messageType === "gif" || messageType === "image" || messageType === "video") && !/^https?:\/\//i.test(trimmed)) {
      isSendingRef.current = false;
      return { error: new Error("Invalid media URL") };
    }

    try {
      const { error } = await supabase.from("private_messages").insert({
        sender_id: user.id,
        receiver_id: otherUserId,
        message: trimmed,
        message_type: messageType,
      });

      if (!error) {
        // Do NOT call fetchMessages() here — the realtime subscription delivers
        // the new message. Calling fetchMessages() AND having realtime both append
        // the same row is the root cause of the duplicate-message bug.

        // Fire-and-forget push to recipient
        void (async () => {
          const [{ data: senderProfile }, { count: threadCount }] = await Promise.all([
            supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle(),
            supabase
              .from("private_messages")
              .select("*", { count: "exact", head: true })
              .or(
                `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
              ),
          ]);
          const senderName = senderProfile?.name || "Someone";
          // Only one message in the whole thread (the one we just sent) → this is a brand-new
          // conversation, so frame the push as a chat invite rather than a generic message.
          const isFirstEverMessage = (threadCount ?? 0) <= 1;
          const title = isFirstEverMessage
            ? `${senderName} wants to chat with you 💬`
            : `${senderName} sent you a message 💬`;
          await supabase.functions.invoke("send-push-notification", {
            body: {
              to_user_id: otherUserId,
              title,
              body: trimmed.slice(0, 80),
              data: { tab: "chat", other_user_id: user.id },
            },
          });
        })();
      }

      return { error };
    } finally {
      isSendingRef.current = false;
    }
  };

  // Mark messages as read
  const markAsRead = async () => {
    if (!user || !isValidUuid(otherUserId)) return;

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

  // Delete a message — only the sender can delete their own messages
  const deleteMessage = async (messageId: string) => {
    if (!user) return { error: new Error("Not authenticated") };
    const { error } = await supabase
      .from("private_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", user.id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    return { error };
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !isValidUuid(otherUserId)) return;

    const channel = supabase
      .channel(`private-messages-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        (payload) => {
          const newMessage = payload.new as PrivateMessage;
          if (
            (newMessage.sender_id === user.id && newMessage.receiver_id === otherUserId) ||
            (newMessage.sender_id === otherUserId && newMessage.receiver_id === user.id)
          ) {
            setMessages((prev) =>
              prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "private_messages" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
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
    deleteMessage,
    refreshMessages: fetchMessages,
  };
}
