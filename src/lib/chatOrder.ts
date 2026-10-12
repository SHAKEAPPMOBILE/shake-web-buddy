import { isToday, isTomorrow } from "date-fns";
import { parseDbDate } from "@/lib/date-utils";

export interface ChatOrderFields {
  /** When the latest message in the chat was sent or received. */
  last_message_at?: string | null;
  /** The chat's plan/event date — only used for chats with no messages yet. */
  scheduled_for?: string;
}

function safeDate(iso: string | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Chat list order: the chat with the newest message — sent by me or received — first, then the next
 * newest, for every kind of chat. Chats with no messages yet go below those, ordered by their date
 * (Today, Tomorrow, then the rest chronologically).
 */
export function compareChats(a: ChatOrderFields, b: ChatOrderFields): number {
  const tA = a.last_message_at ? parseDbDate(a.last_message_at).getTime() : NaN;
  const tB = b.last_message_at ? parseDbDate(b.last_message_at).getTime() : NaN;
  const hasA = !Number.isNaN(tA);
  const hasB = !Number.isNaN(tB);
  if (hasA !== hasB) return hasA ? -1 : 1;
  if (hasA && hasB && tA !== tB) return tB - tA;

  const dateA = safeDate(a.scheduled_for);
  const dateB = safeDate(b.scheduled_for);
  const todayA = isToday(dateA), todayB = isToday(dateB);
  if (todayA && !todayB) return -1;
  if (!todayA && todayB) return 1;
  const tomorrowA = isTomorrow(dateA), tomorrowB = isTomorrow(dateB);
  if (tomorrowA && !tomorrowB) return -1;
  if (!tomorrowA && tomorrowB) return 1;
  return dateA.getTime() - dateB.getTime();
}
