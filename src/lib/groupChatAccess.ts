/**
 * Persists event IDs the current user has paid for group chat access.
 * Key shape in localStorage: { [userId]: eventId[] }
 */
const STORAGE_KEY = "groupChatAccess";

type GroupChatAccessStore = Record<string, string[]>;

function readStore(): GroupChatAccessStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as GroupChatAccessStore;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeStore(store: GroupChatAccessStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

export function getGroupChatAccessIds(userId: string): string[] {
  const s = readStore();
  const ids = s[userId];
  return Array.isArray(ids) ? ids : [];
}

export function hasGroupChatAccess(userId: string, eventId: string): boolean {
  return getGroupChatAccessIds(userId).includes(eventId);
}

export function addGroupChatAccess(userId: string, eventId: string) {
  const s = readStore();
  const cur = s[userId] ?? [];
  if (cur.includes(eventId)) return;
  s[userId] = [...cur, eventId];
  writeStore(s);
}
