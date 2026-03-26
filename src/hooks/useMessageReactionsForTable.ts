import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EventChatReactionRow } from "@/lib/eventChatReactions";

const REACTION_TABLES = ["event_chat_reactions", "activity_message_reactions", "plan_message_reactions"] as const;
export type ChatReactionTable = (typeof REACTION_TABLES)[number];

type Options = {
  table: ChatReactionTable;
  realtimeChannelId: string;
  messageIds: string[];
  userId: string | undefined;
  enabled: boolean;
};

/**
 * Loads reactions from a message-reactions table, realtime insert/delete, one reaction per user per message.
 */
export function useMessageReactionsForTable({
  table,
  realtimeChannelId,
  messageIds,
  userId,
  enabled,
}: Options) {
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
        .from(table)
        .select("id, message_id, user_id, emoji")
        .in("message_id", messageIds);

      if (cancelled) return;
      if (error) {
        console.warn(`[useMessageReactionsForTable:${table}] fetch failed`, error);
        setRows([]);
        return;
      }
      setRows((data ?? []) as EventChatReactionRow[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, idsKey, table]);

  useEffect(() => {
    if (!enabled || !realtimeChannelId) return;

    const channel = supabase
      .channel(realtimeChannelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        (payload) => {
          const row = payload.new as EventChatReactionRow;
          if (!messageIdsRef.current.includes(row.message_id)) return;
          setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table },
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
  }, [enabled, realtimeChannelId, table]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId || !enabled) return;

      const mine = rowsRef.current.find((r) => r.message_id === messageId && r.user_id === userId);

      if (mine?.emoji === emoji) {
        const { error } = await supabase.from(table).delete().eq("id", mine.id);
        if (error) {
          console.warn(`[useMessageReactionsForTable:${table}] delete failed`, error);
          return;
        }
        setRows((prev) => prev.filter((r) => r.id !== mine.id));
        return;
      }

      if (mine) {
        const { error: delErr } = await supabase.from(table).delete().eq("id", mine.id);
        if (delErr) {
          console.warn(`[useMessageReactionsForTable:${table}] delete (replace) failed`, delErr);
          return;
        }
        setRows((prev) => prev.filter((r) => r.id !== mine.id));
      }

      const { data, error } = await supabase
        .from(table)
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select("id, message_id, user_id, emoji")
        .single();

      if (error) {
        console.warn(`[useMessageReactionsForTable:${table}] insert failed`, error);
        return;
      }
      if (data) {
        const row = data as EventChatReactionRow;
        setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
      }
    },
    [userId, enabled, table]
  );

  return { rows, toggleReaction };
}
