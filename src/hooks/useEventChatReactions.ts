import { useMessageReactionsForTable } from "@/hooks/useMessageReactionsForTable";

type UseEventChatReactionsOptions = {
  eventId: string;
  messageIds: string[];
  userId: string | undefined;
  enabled: boolean;
};

/**
 * Event chat reactions — thin wrapper over `event_chat_reactions` + Realtime.
 */
export function useEventChatReactions({
  eventId,
  messageIds,
  userId,
  enabled,
}: UseEventChatReactionsOptions) {
  return useMessageReactionsForTable({
    table: "event_chat_reactions",
    realtimeChannelId: `event-chat-reactions:${eventId}`,
    messageIds,
    userId,
    enabled,
  });
}
