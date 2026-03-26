import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EventChatReactionRow } from "@/lib/eventChatReactions";

type UseEventChatReactionsOptions = {
  eventId: string;
  messageIds: string[];
  userId: string | undefined;
  enabled: boolean;
};

/**
 * Loads reactions for the given messages, keeps them in sync via Realtime (insert/delete),
 * and exposes toggle (insert or delete own row for message + emoji).
 */
export function useEventChatReactions({
  eventId,
  messageIds,
  userId,
  enabled,
}: UseEventChatReactionsOptions) {
  const [rows, setRows] = useState<EventChatReactionRow[]>([]);
  const messageIdsRef = useRef<string[]>([]);
  messageIdsRef.current = messageIds;
  const rowsRef = useRef<EventChatReactionRow[]>([]);
  rowsRef.current = rows;

  const idsKey = messageIds.length ? [...messageIds].sort().join(",") : "";

  useEffect(() => {
    if (!enabled || messageIds.length === 0) {
      setRows([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("event_chat_reactions")
        .select("id, message_id, user_id, emoji")
        .in("message_id", messageIds);

      if (cancelled) return;
      if (error) {
        console.warn("[useEventChatReactions] fetch failed", error);
        setRows([]);
        return;
      }
      setRows((data ?? []) as EventChatReactionRow[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, idsKey]);

  useEffect(() => {
    if (!enabled || !eventId) return;

    const channel = supabase
      .channel(`event-chat-reactions:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_chat_reactions" },
        (payload) => {
          const row = payload.new as EventChatReactionRow;
          if (!messageIdsRef.current.includes(row.message_id)) return;
          setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "event_chat_reactions" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, eventId]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId || !enabled) return;

      const existing = rowsRef.current.find(
        (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji
      );

      if (existing) {
        const { error } = await supabase.from("event_chat_reactions").delete().eq("id", existing.id);
        if (error) {
          console.warn("[useEventChatReactions] delete failed", error);
          return;
        }
        setRows((prev) => prev.filter((r) => r.id !== existing.id));
        return;
      }

      const { data, error } = await supabase
        .from("event_chat_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select("id, message_id, user_id, emoji")
        .single();

      if (error) {
        console.warn("[useEventChatReactions] insert failed", error);
        return;
      }
      if (data) {
        const row = data as EventChatReactionRow;
        setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
      }
    },
    [userId, enabled]
  );

  return { rows, toggleReaction };
}
