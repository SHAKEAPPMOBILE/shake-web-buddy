/** Dispatched on `window` after updating storage so unread hooks can refetch immediately. */
export const EVENT_CHAT_VIEWED_EVENT = "shake-event-chat-viewed";

const STORAGE_KEY = "shake_event_chat_last_seen_v1";

export function readEventChatLastSeenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

/** Persist `eventId` → ISO timestamp; notify listeners (e.g. tab bar badge). */
export function markEventChatViewedNow(eventId: string): void {
  const id = eventId.trim();
  if (!id) return;
  const map = readEventChatLastSeenMap();
  map[id] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT_CHAT_VIEWED_EVENT, { detail: { eventId: id } }));
}
