import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { getActivityLabel } from "@/data/activityTypes";

const ICS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-ics`;
const REAL_PLAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Plans have a start but no end; calendars need one. Matches the plan-ics function.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Carousel cards have synthetic ids and no date of their own, so only real plans can be added. */
export const canAddToCalendar = (activityId: string) => REAL_PLAN_ID.test(activityId);

export type CalendarKind = "device" | "google" | "outlook";

export interface CalendarPlan {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  details: string;
  recurrence: "weekly" | "biweekly" | "monthly" | null;
}

const openUrl = async (url: string) => {
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
};

export async function fetchCalendarPlan(activityId: string): Promise<CalendarPlan | null> {
  const { data } = await supabase
    .from("user_activities")
    .select("id, activity_type, note, title, description, scheduled_for, venue_name, venue_address, city, recurrence")
    .eq("id", activityId)
    .maybeSingle();
  const row = data as {
    id: string; activity_type: string; note: string | null; title: string | null; description: string | null;
    scheduled_for: string | null; venue_name: string | null; venue_address: string | null; city: string | null;
    recurrence: CalendarPlan["recurrence"];
  } | null;
  if (!row?.scheduled_for) return null;
  const start = new Date(row.scheduled_for);
  const link = `https://www.shakeapp.today/invite/${row.id}`;
  return {
    id: row.id,
    title: (row.note?.trim() || row.title?.trim() || getActivityLabel(row.activity_type)).slice(0, 120),
    start,
    end: new Date(start.getTime() + DEFAULT_DURATION_MS),
    location: [row.venue_name, row.venue_address, row.city].filter(Boolean).join(", "),
    details: [row.description?.trim(), link].filter(Boolean).join("\n\n"),
    recurrence: row.recurrence,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const compactUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const GOOGLE_RRULES = { weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY" } as const;

/** Google Calendar's "create event" page, filled in. Recurring plans carry their repeat rule. */
export function googleCalendarUrl(plan: CalendarPlan): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: plan.title,
    dates: `${compactUtc(plan.start)}/${compactUtc(plan.end)}`,
    details: plan.details,
  });
  if (plan.location) params.set("location", plan.location);
  if (plan.recurrence) params.set("recur", `RRULE:${GOOGLE_RRULES[plan.recurrence]}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook on the web's compose page, filled in (its link format has no repeat rule). */
export function outlookCalendarUrl(plan: CalendarPlan): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: plan.title,
    startdt: plan.start.toISOString(),
    enddt: plan.end.toISOString(),
    body: plan.details,
  });
  if (plan.location) params.set("location", plan.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Sends the plan to the chosen calendar. "device" hands a standard .ics file to the phone (iOS and Android
 * offer to add it to whatever calendar app is set up, with a reminder an hour before and a repeat rule for
 * recurring plans); Google and Outlook open their own "new event" page prefilled.
 */
export async function addToCalendar(activityId: string, kind: CalendarKind): Promise<boolean> {
  if (kind === "device") {
    await openUrl(`${ICS_ENDPOINT}?id=${encodeURIComponent(activityId)}`);
    return true;
  }
  const plan = await fetchCalendarPlan(activityId);
  if (!plan) return false;
  await openUrl(kind === "google" ? googleCalendarUrl(plan) : outlookCalendarUrl(plan));
  return true;
}
