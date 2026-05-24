export const MAX_INTERESTS = 7;

export interface InterestCategory {
  name: string;
  interests: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    name: "Music",
    interests: ["Music", "Rock", "Hip-Hop", "Electronic", "Jazz", "Latin", "Pop", "Indie", "Classical", "Live Music"],
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
    interests: ["Nightlife", "Parties", "Bars", "Beach", "Adventure"],
  },
  {
    name: "Health & Wellness",
    interests: ["Fitness", "Yoga", "Running", "Cycling", "Meditation", "Mental Health", "Nutrition", "Hiking", "Gym"],
  },
  {
    name: "Causes & Identity",
    interests: ["LGBTQ+", "Feminism", "Activism", "Sustainability", "Climate", "Human Rights", "Politics", "Social Justice"],
  },
];

/** Flat list of every interest across all categories (for backwards-compat display). */
export const PRESET_INTERESTS: string[] = INTEREST_CATEGORIES.flatMap((c) => c.interests);
