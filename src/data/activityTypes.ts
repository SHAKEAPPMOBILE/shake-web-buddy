// Activity types configuration
import bgBarManCook from "@/assets/bar-man-and-cook.png";

export interface ActivityType {
  id: string;
  label: string;
  emoji: string;
  icon?: string;
  color: string;
  bgImage?: string;
  defaultDay?: number; // 0 = Sunday, 1 = Monday, etc.
}

// Day names for display
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Get the day name for an activity
export const getActivityDay = (id: string): string => {
  const activity = ACTIVITY_TYPES.find(a => a.id === id);
  if (activity?.defaultDay !== undefined) {
    return DAY_NAMES[activity.defaultDay];
  }
  return '';
};

// Get the next occurrence date for an activity based on its default day
export const getNextOccurrenceDate = (activityId: string): Date => {
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Normalize to noon
  
  if (activity?.defaultDay === undefined) {
    return today;
  }
  
  const targetDay = activity.defaultDay;
  const currentDay = today.getDay();
  
  // Calculate days until target day
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) {
    daysUntil += 7; // Next week
  }
  if (daysUntil === 0) {
    daysUntil = 7; // Always return next week's occurrence, not today
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
};

// Get activity with its next occurrence date
export interface ActivityWithDate extends ActivityType {
  nextDate: Date;
  dayNumber: number;
  dayNameShort: string;
}

// Fixed order for carousel: Drinks, Dinner, Brunch
const FIXED_CAROUSEL_ORDER = ['drinks', 'dinner', 'brunch'];

// Get activities in FIXED order with their next occurrence dates
export function getActivitiesWithDates(): ActivityWithDate[] {
  return FIXED_CAROUSEL_ORDER.map(id => {
    const activity = ACTIVITY_TYPES.find(a => a.id === id)!;
    const nextDate = getNextOccurrenceDate(activity.id);
    return {
      ...activity,
      nextDate,
      dayNumber: nextDate.getDate(),
      dayNameShort: DAY_NAMES_SHORT[nextDate.getDay()],
    };
  });
}

// Get the starting index based on which activity is closest to today
export function getStartingIndexByProximity(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDayOfWeek = today.getDay();
  
  let closestIndex = 0;
  let minDaysUntil = 7;
  
  FIXED_CAROUSEL_ORDER.forEach((id, index) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === id);
    if (!activity) return;
    
    const targetDay = activity.defaultDay ?? 0;
    let daysUntil = targetDay - currentDayOfWeek;
    if (daysUntil < 0) daysUntil += 7;
    
    if (daysUntil < minDaysUntil) {
      minDaysUntil = daysUntil;
      closestIndex = index;
    }
  });
  
  return closestIndex;
}

// Carousel activities with specific days (drinks, dinner, brunch)
export const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: "dinner",
    label: "Dinner",
    emoji: "🍝",
    icon: "/icons/activities/dinner-icon.jpg",
    color: "bg-shake-purple/20 hover:bg-shake-purple/30",
    bgImage: bgBarManCook,
    defaultDay: 6 // Saturday
  },
  {
    id: "drinks",
    label: "Drinks",
    emoji: "🍹",
    icon: "/icons/activities/drinks-icon.jpg",
    color: "bg-shake-teal/20 hover:bg-shake-teal/30",
    bgImage: bgBarManCook,
    defaultDay: 5 // Friday
  },
  {
    id: "brunch",
    label: "Brunch",
    emoji: "🥐",
    icon: "/icons/activities/brunch-icon.jpg",
    color: "bg-shake-yellow/20 hover:bg-shake-yellow/30",
    bgImage: bgBarManCook,
    defaultDay: 0 // Sunday
  },
];

// Additional activities only for "create a plan" dialog (excludes carousel activities)
// Note: Legacy activity types (surf, run, co-working, basketball, tennis-padel, football, shopping, arts) 
// have been removed as they are no longer in use
export const PLAN_ONLY_ACTIVITY_TYPES: ActivityType[] = [];

// All activities combined (for lookups and helpers)
export const ALL_ACTIVITY_TYPES: ActivityType[] = [...ACTIVITY_TYPES, ...PLAN_ONLY_ACTIVITY_TYPES];

// Helper functions
export const getActivityById = (id: string): ActivityType | undefined => {
  return ALL_ACTIVITY_TYPES.find(a => a.id === id);
};

export const getActivityEmoji = (id: string): string => {
  return getActivityById(id)?.emoji || "📍";
};

export const getActivityLabel = (id: string): string => {
  return getActivityById(id)?.label || id;
};

export const getActivityColor = (id: string): string => {
  return getActivityById(id)?.color || "bg-muted/20";
};

export const getActivityIcon = (id: string): string | undefined => {
  return getActivityById(id)?.icon;
};

// Get default activity based on current day of week
export function getTimeBasedDefaultActivity(): string {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  
  // Find activity that matches today's day (from standard activities only)
  const todayActivity = ACTIVITY_TYPES.find(a => a.defaultDay === day);
  if (todayActivity) {
    return todayActivity.id;
  }
  
  // Fallback for days with no default - use drinks
  return "drinks";
}

// Get the index of today's default activity (always 0 since list is reordered)
export function getTodayDefaultIndex(): number {
  return 0;
}

// Get activities ordered starting from today, then chronologically through the week
export function getOrderedActivities(): ActivityType[] {
  const today = new Date().getDay();
  
  return [...ACTIVITY_TYPES].sort((a, b) => {
    const dayA = a.defaultDay ?? 0;
    const dayB = b.defaultDay ?? 0;
    
    // Calculate distance from today (wrapping around the week)
    const distA = (dayA - today + 7) % 7;
    const distB = (dayB - today + 7) % 7;
    
    return distA - distB;
  });
}
