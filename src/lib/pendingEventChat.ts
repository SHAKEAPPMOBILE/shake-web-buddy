/**
 * Optimistic event-chat rows for the Chat tab when membership is confirmed locally
 * before the next full list fetch sees `event_chat_members`.
 */
const STORAGE_KEY = "shake_pending_event_chats_v1";

export const PENDING_EVENT_CHAT_CHANGED = "shake:pending-event-chat-changed";

export type PendingEventChatPayload = {
  event_id: string;
  event_name: string;
  city?: string;
  event_starts_at?: string | null;
  expires_at?: string | null;
};

type StoredEntry = PendingEventChatPayload & { added_at: number };

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readRaw(): StoredEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StoredEntry =>
        e &&
        typeof e === "object" &&
        typeof (e as StoredEntry).event_id === "string" &&
        typeof (e as StoredEntry).added_at === "number"
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: StoredEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function enqueuePendingEventChat(payload: PendingEventChatPayload) {
  const now = Date.now();
  const prev = readRaw().filter((e) => e.event_id !== payload.event_id);
  prev.push({
    ...payload,
    added_at: now,
  });
  writeRaw(prev);
  try {
    window.dispatchEvent(new CustomEvent(PENDING_EVENT_CHAT_CHANGED));
  } catch {
    /* ignore */
  }
}

export function getPendingEventChatsForMerge(): PendingEventChatPayload[] {
  const raw = readRaw();
  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = raw.filter((e) => e.added_at >= cutoff);
  if (fresh.length !== raw.length) writeRaw(fresh);
  return fresh.map(({ added_at: _a, ...rest }) => rest);
}

export function removePendingEventChat(eventId: string) {
  const next = readRaw().filter((e) => e.event_id !== eventId);
  writeRaw(next);
}
