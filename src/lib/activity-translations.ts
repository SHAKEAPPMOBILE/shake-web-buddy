import { TFunction } from "i18next";
import { ACTIVITY_TYPES } from "@/data/activityTypes";

const ACTIVITY_KEY_MAP: Record<string, string> = {
  lunch: "lunch", dinner: "dinner", drinks: "drinks", brunch: "brunch",
  hike: "hike", surf: "surf", run: "run", "co-working": "coWorking",
  basketball: "basketball", "tennis-padel": "tennisPadel",
  football: "football", shopping: "shopping", arts: "arts",
};

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
const DAY_SHORT_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

export function getTranslatedActivityLabel(t: TFunction, activityId: string): string {
  const key = ACTIVITY_KEY_MAP[activityId];
  if (key) return t(`activities.${key}`, activityId);
  return activityId.charAt(0).toUpperCase() + activityId.slice(1);
}

export function getTranslatedDayName(t: TFunction, dayIndex: number): string {
  const key = DAY_KEYS[dayIndex];
  return key ? t(`days.${key}`) : "";
}

export function getTranslatedDayNameShort(t: TFunction, dayIndex: number): string {
  const key = DAY_SHORT_KEYS[dayIndex];
  return key ? t(`days.${key}`) : "";
}

export function getTranslatedActivityDay(t: TFunction, activityId: string): string {
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  if (activity?.defaultDay !== undefined) {
    return getTranslatedDayName(t, activity.defaultDay);
  }
  return "";
}
