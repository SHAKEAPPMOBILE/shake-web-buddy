import { ActivityType } from "@/data/activityTypes";

export interface Activity extends ActivityType {
  startTime?: string; // "HH:mm" optional
  startHour?: number;
  startMinute?: number;
  isFull?: boolean;
  isJoined?: boolean;
  capacity?: number;
  participants?: number;
  userIsJoined?: boolean;
}

function parseActivityTime(activity: Activity): { hour: number; minute: number } {
  if (activity.startHour !== undefined && activity.startMinute !== undefined) {
    return { hour: activity.startHour, minute: activity.startMinute };
  }

  if (activity.startTime) {
    const [hourStr, minuteStr] = activity.startTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isNaN(hour) && !Number.isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return { hour, minute };
    }
  }

  // Fallback: default to midday 12:00
  return { hour: 12, minute: 0 };
}

function toMinutesOfDay(time: { hour: number; minute: number }): number {
  return time.hour * 60 + time.minute;
}

function isActivityFull(activity: Activity): boolean {
  if (activity.isFull === true) return true;
  if (activity.capacity !== undefined && activity.participants !== undefined) {
    return activity.participants >= activity.capacity;
  }
  return false;
}

function isActivityJoined(activity: Activity): boolean {
  return activity.isJoined === true || activity.userIsJoined === true;
}

/**
 * Get the best matching Shake activity based on schedule:
 * - Current day of week (0 = Sunday, 6 = Saturday)
 * - Chooses today activities not started yet (start time in future)
 * - If none, chooses the next activity in the coming days
 * - Skips full activities and already joined activities
 * - Returns one best activity (or null if none)
 */
export function getShakeActivity(activities: Activity[]): Activity | null {
  if (!activities || activities.length === 0) {
    return null;
  }

  const eligible = activities.filter((activity) => !isActivityFull(activity) && !isActivityJoined(activity));
  if (eligible.length === 0) {
    return null;
  }

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayUpcoming = eligible
    .filter((activity) => activity.defaultDay !== undefined && activity.defaultDay === currentDayOfWeek)
    .map((activity) => ({ activity, time: toMinutesOfDay(parseActivityTime(activity)) }))
    .filter(({ time }) => time > nowMinutes)
    .sort((a, b) => a.time - b.time);

  if (todayUpcoming.length > 0) {
    return todayUpcoming[0].activity;
  }

  // No upcoming today, find the next soonest activity in the upcoming week.
  const futureCandidates = eligible
    .filter((activity) => activity.defaultDay !== undefined)
    .map((activity) => {
      const targetDay = activity.defaultDay as number;
      let daysUntil = (targetDay - currentDayOfWeek + 7) % 7;
      if (daysUntil === 0) {
        // This is today but already passed.
        daysUntil = 7;
      }
      const time = toMinutesOfDay(parseActivityTime(activity));
      return { activity, daysUntil, time };
    })
    .sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return a.time - b.time;
    });

  if (futureCandidates.length === 0) {
    return null;
  }

  return futureCandidates[0].activity;
}
