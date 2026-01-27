// Activity types configuration
import iconLunch from "@/assets/icon-lunch.png";
import iconDinner from "@/assets/icon-dinner.png";
import iconDrinks from "@/assets/icon-drinks.png";
import iconHike from "@/assets/icon-hike.png";
import bgBarManCook from "@/assets/bar-man-and-cook.png";
import bgHiker from "@/assets/hiker-illustration.png";

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
  // If it's the same day, it's today (daysUntil = 0)
  
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

// Get activities ordered by next occurrence date (chronological)
export function getActivitiesWithDates(): ActivityWithDate[] {
  return ACTIVITY_TYPES.map(activity => {
    const nextDate = getNextOccurrenceDate(activity.id);
    return {
      ...activity,
      nextDate,
      dayNumber: nextDate.getDate(),
      dayNameShort: DAY_NAMES_SHORT[nextDate.getDay()],
    };
  }).sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}

// Carousel activities with specific days (lunch, dinner, drinks, hike)
export const ACTIVITY_TYPES: ActivityType[] = [
  { 
    id: "lunch", 
    label: "Lunch", 
    emoji: "🍽️",
    icon: iconLunch,
    color: "bg-shake-coral/20 hover:bg-shake-coral/30",
    bgImage: bgBarManCook,
    defaultDay: 4 // Thursday
  },
  { 
    id: "dinner", 
    label: "Dinner", 
    emoji: "🍝",
    icon: iconDinner,
    color: "bg-shake-purple/20 hover:bg-shake-purple/30",
    bgImage: bgBarManCook,
    defaultDay: 6 // Saturday
  },
  { 
    id: "drinks", 
    label: "Drinks", 
    emoji: "🍹",
    icon: iconDrinks,
    color: "bg-shake-teal/20 hover:bg-shake-teal/30",
    bgImage: bgBarManCook,
    defaultDay: 5 // Friday
  },
  { 
    id: "brunch", 
    label: "Brunch", 
    emoji: "🥐",
    icon: iconLunch,
    color: "bg-shake-yellow/20 hover:bg-shake-yellow/30",
    bgImage: bgBarManCook,
    defaultDay: 0 // Sunday
  },
  { 
    id: "hike", 
    label: "Hike", 
    emoji: "⛰️",
    icon: iconHike,
    color: "bg-shake-green/20 hover:bg-shake-green/30",
    bgImage: bgHiker,
    defaultDay: 0 // Sunday
  },
];

// Additional activities only for "create a plan" dialog (excludes carousel activities)
export const PLAN_ONLY_ACTIVITY_TYPES: ActivityType[] = [
  { 
    id: "surf", 
    label: "Surf", 
    emoji: "🏄",
    color: "bg-blue-500/20 hover:bg-blue-500/30",
  },
  { 
    id: "run", 
    label: "Run", 
    emoji: "🏃",
    color: "bg-shake-coral/20 hover:bg-shake-coral/30",
  },
  { 
    id: "co-working", 
    label: "Co-working", 
    emoji: "💻",
    color: "bg-slate-500/20 hover:bg-slate-500/30",
  },
  { 
    id: "basketball", 
    label: "Basketball", 
    emoji: "🏀",
    color: "bg-shake-coral/20 hover:bg-shake-coral/30",
  },
  { 
    id: "tennis-padel", 
    label: "Tennis/Padel", 
    emoji: "🎾",
    color: "bg-shake-yellow/20 hover:bg-shake-yellow/30",
  },
  { 
    id: "football", 
    label: "Football", 
    emoji: "⚽",
    color: "bg-green-600/20 hover:bg-green-600/30",
  },
  { 
    id: "shopping", 
    label: "Shopping", 
    emoji: "🛍️",
    color: "bg-pink-500/20 hover:bg-pink-500/30",
  },
  { 
    id: "arts", 
    label: "Arts", 
    emoji: "🎨",
    color: "bg-purple-500/20 hover:bg-purple-500/30",
  },
];

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

// Get default activity based on current day of week
export function getTimeBasedDefaultActivity(): string {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  
  // Find activity that matches today's day (from standard activities only)
  const todayActivity = ACTIVITY_TYPES.find(a => a.defaultDay === day);
  if (todayActivity) {
    return todayActivity.id;
  }
  
  // Fallback for Tuesday (no default) - use lunch
  return "lunch";
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
