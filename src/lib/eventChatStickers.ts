/** Stored in `event_chat_messages.content` when message_type === "sticker". */
export const EVENT_CHAT_STICKER_IDS = [
  "guitar_shred",
  "fire_hype",
  "hands_up",
  "confetti_burst",
  "mic_drop",
  "lightning",
  "dancer",
  "music_notes",
] as const;

export type EventChatStickerId = (typeof EVENT_CHAT_STICKER_IDS)[number];

export const EVENT_CHAT_STICKER_SET = new Set<string>(EVENT_CHAT_STICKER_IDS);

export function isEventChatStickerId(id: string): id is EventChatStickerId {
  return EVENT_CHAT_STICKER_SET.has(id);
}

export const EVENT_CHAT_STICKER_LABELS: Record<EventChatStickerId, string> = {
  guitar_shred: "Guitar shred",
  fire_hype: "Fire hype",
  hands_up: "Hands up",
  confetti_burst: "Confetti burst",
  mic_drop: "Mic drop",
  lightning: "Lightning",
  dancer: "Dancer",
  music_notes: "Music notes",
};
