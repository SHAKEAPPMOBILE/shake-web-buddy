export const MAX_INTERESTS = 999;

export interface InterestCategory {
  name: string;
  interests: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    name: "Music",
    // Note: the category's own name ("Music") is intentionally NOT repeated
    // here as a sub-option — it's the mother label, shown above this list,
    // not a selectable interest in its own right.
    interests: ["Rock", "Hip-Hop", "Electronic", "Jazz", "Latin", "Pop", "Indie", "Classical", "Live Music"],
  },
  {
    name: "Activities",
    interests: ["Travel", "Outdoors", "Concerts", "Festivals", "Hiking", "Surf", "Yoga", "Running", "Cycling", "Dancing", "Climbing"],
  },
  {
    name: "Food & Drink",
    interests: ["Food", "Cooking", "Wine", "Coffee", "Brunch", "Cocktails"],
  },
  {
    name: "Creativity",
    interests: ["Art", "Photography", "Film", "Books", "Design", "Writing"],
  },
  {
    name: "Tech & Topics",
    interests: ["Tech", "Podcasts", "Sustainability", "Gaming", "Science"],
  },
  {
    name: "Nightlife",
    // Same as Music above — "Nightlife" itself is the mother label, not a sub-option.
    interests: ["Parties", "Bars", "Beach", "Adventure"],
  },
  {
    name: "Health & Wellness",
    interests: ["Fitness", "Meditation", "Mental Health", "Nutrition", "Gym", "Wellness", "Sleep", "Mindfulness"],
  },
  {
    name: "Causes & Identity",
    interests: ["LGBTQ+", "Feminism", "Activism", "Sustainability", "Climate", "Human Rights", "Politics", "Social Justice"],
  },
];

/** Flat list of every interest across all categories (for backwards-compat display). */
export const PRESET_INTERESTS: string[] = INTEREST_CATEGORIES.flatMap((c) => c.interests);
