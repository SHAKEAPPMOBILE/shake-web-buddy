// Activity detection from user text input
// Maps keywords to activity types for automatic categorization

interface ActivityMatch {
  type: string;
  emoji: string;
  color: string;
}

// Core activity types that are actively used
const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  brunch: ['brunch'],
  dinner: ['dinner', 'supper', 'evening meal', 'restaurant'],
  drinks: ['drinks', 'drink', 'bar', 'pub', 'cocktail', 'beer', 'wine', 'happy hour'],
  yoga: ['yoga'],
  picnic: ['picnic'],
  coffee: ['coffee', 'café', 'cafe', 'espresso', 'latte'],
  beach: ['beach', 'beach day'],
  movie: ['movie', 'cinema', 'film night', 'movie night'],
  karaoke: ['karaoke'],
  gaming: ['gaming', 'video game', 'video games', 'game night'],
  museum: ['museum', 'gallery', 'exhibit', 'exhibition'],
  bike: ['bike ride', 'bike', 'biking', 'cycling'],
  surf: ['surf', 'surfing'],
};

// Core activity types configuration
const ACTIVITY_CONFIG: Record<string, { emoji: string; color: string }> = {
  brunch: { emoji: '🥐', color: 'bg-shake-yellow/20' },
  dinner: { emoji: '🍝', color: 'bg-shake-purple/20' },
  drinks: { emoji: '🍹', color: 'bg-shake-teal/20' },
  yoga: { emoji: '🧘', color: 'bg-violet-200/20' },
  picnic: { emoji: '🧺', color: 'bg-amber-200/20' },
  coffee: { emoji: '☕', color: 'bg-emerald-200/20' },
  beach: { emoji: '🏖️', color: 'bg-cyan-200/20' },
  movie: { emoji: '🎬', color: 'bg-rose-200/20' },
  karaoke: { emoji: '🎤', color: 'bg-orange-200/20' },
  gaming: { emoji: '🎮', color: 'bg-indigo-200/20' },
  museum: { emoji: '🖼️', color: 'bg-pink-200/20' },
  bike: { emoji: '🚲', color: 'bg-yellow-200/20' },
  surf: { emoji: '🏄', color: 'bg-blue-200/20' },
  // Default for unmatched
  default: { emoji: '📍', color: 'bg-muted/30' },
};

/**
 * Detects the activity type from user input text
 * Returns the best matching activity with emoji and color
 */
export function detectActivityFromText(text: string): ActivityMatch {
  const lowerText = text.toLowerCase();
  
  // Check each activity type for keyword matches
  for (const [activityType, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        const config = ACTIVITY_CONFIG[activityType] || ACTIVITY_CONFIG.default;
        return {
          type: activityType,
          emoji: config.emoji,
          color: config.color,
        };
      }
    }
  }
  
  // Return default if no match found
  return {
    type: 'general',
    emoji: ACTIVITY_CONFIG.default.emoji,
    color: ACTIVITY_CONFIG.default.color,
  };
}

/**
 * Gets the activity config for a known type
 */
export function getActivityConfig(type: string): { emoji: string; color: string } {
  return ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
}
