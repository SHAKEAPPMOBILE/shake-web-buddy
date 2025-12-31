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

// Get the day name for an activity
export const getActivityDay = (id: string): string => {
  const activity = ACTIVITY_TYPES.find(a => a.id === id);
  if (activity?.defaultDay !== undefined) {
    return DAY_NAMES[activity.defaultDay];
  }
  return '';
};

export const ACTIVITY_TYPES: ActivityType[] = [
  { 
    id: "lunch", 
    label: "Lunch", 
    emoji: "🍽️",
    icon: iconLunch,
    color: "bg-shake-coral/20 hover:bg-shake-coral/30",
    bgImage: bgBarManCook,
    defaultDay: 1 // Monday
  },
  { 
    id: "dinner", 
    label: "Dinner", 
    emoji: "🍝",
    icon: iconDinner,
    color: "bg-shake-purple/20 hover:bg-shake-purple/30",
    bgImage: bgBarManCook,
    defaultDay: 4 // Thursday
  },
  { 
    id: "drinks", 
    label: "Drinks", 
    emoji: "🍻",
    icon: iconDrinks,
    color: "bg-shake-teal/20 hover:bg-shake-teal/30",
    bgImage: bgBarManCook,
    defaultDay: 5 // Friday
  },
  { 
    id: "hike", 
    label: "Hike", 
    emoji: "🥾",
    icon: iconHike,
    color: "bg-shake-green/20 hover:bg-shake-green/30",
    bgImage: bgHiker,
    defaultDay: 0 // Sunday
  },
  { 
    id: "surf", 
    label: "Surf", 
    emoji: "🏄",
    color: "bg-blue-500/20 hover:bg-blue-500/30",
    defaultDay: 6 // Saturday
  },
  { 
    id: "run", 
    label: "Run", 
    emoji: "🏃",
    color: "bg-orange-500/20 hover:bg-orange-500/30",
    defaultDay: 6 // Saturday (alternate)
  },
  { 
    id: "co-working", 
    label: "Co-working", 
    emoji: "💻",
    color: "bg-slate-500/20 hover:bg-slate-500/30",
    defaultDay: 3 // Wednesday
  },
];

// Helper functions
export const getActivityById = (id: string): ActivityType | undefined => {
  return ACTIVITY_TYPES.find(a => a.id === id);
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
  
  // Find activity that matches today's day
  const todayActivity = ACTIVITY_TYPES.find(a => a.defaultDay === day);
  if (todayActivity) {
    return todayActivity.id;
  }
  
  // Fallback for Tuesday (no default) - use lunch
  return "lunch";
}

// Get the index of today's default activity
export function getTodayDefaultIndex(): number {
  const day = new Date().getDay();
  const index = ACTIVITY_TYPES.findIndex(a => a.defaultDay === day);
  return index >= 0 ? index : 0;
}
