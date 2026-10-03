import { format, isToday, isTomorrow } from "date-fns";
import { ACTIVITY_START_TIMES, getActivityLabel } from "@/data/activityTypes";
import { getPlanEmojis } from "@/lib/activityDetection";
import { getShareLabel } from "@/lib/utils";
import { parseDbDate } from "@/lib/date-utils";

/** The slice of a plan the share sheet needs — FeedPlan and PlansTab's PlanActivity both fit it. */
export interface SharePlan {
  id: string;
  activity_type: string;
  city: string;
  scheduled_for?: string | null;
  note?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
  background_id?: string | null;
  is_auto_generated?: boolean | null;
  isCarouselJoin?: boolean;
}

/**
 * Everything every share channel needs, built once. This is the text and link
 * the app used to assemble separately in PlanSwipeFeed and PlansTab, kept
 * byte-for-byte the same so recipients see exactly what they saw before.
 */
export function buildPlanShare(plan: SharePlan, userId?: string | null) {
  const label = getShareLabel(plan.note, getActivityLabel(plan.activity_type));
  const emojis = getPlanEmojis(plan.activity_type, plan.note);
  const emoji = emojis.slice(0, 3).join("") || "📍";
  const dateStr = plan.scheduled_for
    ? format(parseDbDate(plan.scheduled_for), "EEE, d MMM")
    : format(new Date(), "EEE, d MMM");
  // Carousel plans have a synthetic id, so the invite link encodes type + city + sharer instead.
  const shareId = plan.id.startsWith("carousel-")
    ? `${plan.activity_type}-${plan.city}-${userId ?? ""}`
    : plan.id;
  const url = `https://www.shakeapp.today/invite/${encodeURIComponent(shareId)}`;
  const text = `${emoji} Join me for ${label} in ${plan.city} on ${dateStr}! Let's SHAKE up our social life together.`;
  const title = `SHAKE - ${label} in ${plan.city}`;
  return { label, emoji, dateStr, url, text, title, message: `${text}\n${url}` };
}

/** "Today · 8:00 PM", "Sun, 4 Oct · 8:00 PM" — same rules as the swipe feed's date line. */
export function formatPlanWhen(
  plan: Pick<SharePlan, "scheduled_for" | "is_auto_generated" | "activity_type">,
  labels: { today: string; tomorrow: string } = { today: "Today", tomorrow: "Tomorrow" },
): string | null {
  if (!plan.scheduled_for) return null;
  const d = parseDbDate(plan.scheduled_for);
  if (isNaN(d.getTime())) return null;
  const day = isToday(d) ? labels.today : isTomorrow(d) ? labels.tomorrow : format(d, "EEE, d MMM");
  // Standing (auto-generated) plans carry a synthetic noon timestamp — the real start time is per activity type.
  const time = plan.is_auto_generated ? ACTIVITY_START_TIMES[plan.activity_type] : format(d, "h:mm a");
  return time ? `${day} · ${time}` : day;
}
