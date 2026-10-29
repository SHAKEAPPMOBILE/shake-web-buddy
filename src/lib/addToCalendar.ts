import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const ICS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-ics`;
const REAL_PLAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Carousel cards have synthetic ids and no date of their own, so only real plans can be added. */
export const canAddToCalendar = (activityId: string) => REAL_PLAN_ID.test(activityId);

/**
 * Hands the plan to the phone's calendar. The server builds a standard .ics file (with a repeat rule
 * for recurring plans and a reminder an hour before); on iOS and Android the system offers to add it,
 * on the web it downloads.
 */
export async function openAddToCalendar(activityId: string): Promise<void> {
  const url = `${ICS_ENDPOINT}?id=${encodeURIComponent(activityId)}`;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
