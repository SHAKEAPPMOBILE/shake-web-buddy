export const EVENT_CHAT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;
export type EventChatQuickEmoji = (typeof EVENT_CHAT_QUICK_REACTIONS)[number];

export type EventChatReactionRow = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type ReactionChip = { emoji: string; count: number; mine: boolean };

/** Group raw rows into per-message emoji counts; `mine` if current user reacted with that emoji. */
export function aggregateReactionsByMessage(
  rows: Pick<EventChatReactionRow, "message_id" | "user_id" | "emoji">[],
  currentUserId: string | undefined
): Record<string, Record<string, { count: number; mine: boolean }>> {
  const out: Record<string, Record<string, { count: number; mine: boolean }>> = {};
  for (const r of rows) {
    if (!out[r.message_id]) out[r.message_id] = {};
    const prev = out[r.message_id][r.emoji] ?? { count: 0, mine: false };
    out[r.message_id][r.emoji] = {
      count: prev.count + 1,
      mine: prev.mine || (!!currentUserId && r.user_id === currentUserId),
    };
  }
  return out;
}

export function sortedReactionEntries(
  map: Record<string, { count: number; mine: boolean }>
): ReactionChip[] {
  const order = [...EVENT_CHAT_QUICK_REACTIONS];
  return Object.entries(map)
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
    .sort((a, b) => {
      const ia = order.indexOf(a.emoji as EventChatQuickEmoji);
      const ib = order.indexOf(b.emoji as EventChatQuickEmoji);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.emoji.localeCompare(b.emoji);
    });
}
