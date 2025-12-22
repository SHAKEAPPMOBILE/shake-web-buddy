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
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { 
    id: "lunch", 
    label: "Lunch", 
    emoji: "🍽️",
    icon: iconLunch,
    color: "bg-shake-coral/20 hover:bg-shake-coral/30",
    bgImage: bgBarManCook
  },
  { 
    id: "dinner", 
    label: "Dinner", 
    emoji: "🍝",
    icon: iconDinner,
    color: "bg-shake-purple/20 hover:bg-shake-purple/30",
    bgImage: bgBarManCook
  },
  { 
    id: "drinks", 
    label: "Drinks", 
    emoji: "🍻",
    icon: iconDrinks,
    color: "bg-shake-teal/20 hover:bg-shake-teal/30",
    bgImage: bgBarManCook
  },
  { 
    id: "hike", 
    label: "Hike", 
    emoji: "🥾",
    icon: iconHike,
    color: "bg-shake-green/20 hover:bg-shake-green/30",
    bgImage: bgHiker
  },
  { 
    id: "surf", 
    label: "Surf", 
    emoji: "🏄",
    color: "bg-blue-500/20 hover:bg-blue-500/30"
  },
  { 
    id: "run", 
    label: "Run", 
    emoji: "🏃",
    color: "bg-orange-500/20 hover:bg-orange-500/30"
  },
  { 
    id: "sunset", 
    label: "Sunset", 
    emoji: "🌅",
    color: "bg-amber-500/20 hover:bg-amber-500/30"
  },
  { 
    id: "dance", 
    label: "Dance", 
    emoji: "💃",
    color: "bg-pink-500/20 hover:bg-pink-500/30"
  },
  { 
    id: "co-working", 
    label: "Co-working", 
    emoji: "💻",
    color: "bg-slate-500/20 hover:bg-slate-500/30"
  },
  { 
    id: "shopping", 
    label: "Shopping", 
    emoji: "🛍️",
    color: "bg-rose-500/20 hover:bg-rose-500/30"
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

// Get smart default activity based on local time and day
export function getTimeBasedDefaultActivity(): string {
  const now = new Date();
  const hours = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;

  // Weekend logic: show hike until 2pm
  if (isWeekend && hours < 14) {
    return "hike";
  }

  // Time-based logic
  if (hours >= 21) {
    return "drinks"; // After 9pm
  } else if (hours >= 14) {
    return "dinner"; // After 2pm
  } else {
    return "lunch"; // Before 2pm
  }
}
