// Activity detection from user text input
// Maps keywords to activity types for automatic categorization

interface ActivityMatch {
  type: string;
  emoji: string;
  color: string;
}

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  surf: ['surf', 'surfing', 'wave', 'waves', 'beach', 'ocean', 'board'],
  run: ['run', 'running', 'jog', 'jogging', 'marathon', 'sprint'],
  hike: ['hike', 'hiking', 'trail', 'mountain', 'trekking', 'walk', 'nature'],
  lunch: ['lunch', 'brunch', 'breakfast', 'morning food'],
  dinner: ['dinner', 'supper', 'evening meal', 'restaurant'],
  drinks: ['drinks', 'drink', 'bar', 'pub', 'cocktail', 'beer', 'wine', 'happy hour'],
  'co-working': ['work', 'working', 'cowork', 'co-work', 'laptop', 'office', 'remote', 'cafe work'],
  basketball: ['basketball', 'hoops', 'bball'],
  'tennis-padel': ['tennis', 'padel', 'racket', 'court'],
  football: ['football', 'soccer', 'futbol', 'match'],
  shopping: ['shopping', 'shop', 'mall', 'store', 'buy'],
  arts: ['art', 'arts', 'museum', 'gallery', 'exhibition', 'paint', 'painting'],
  concert: ['concert', 'music', 'live music', 'gig', 'show', 'band', 'festival'],
  yoga: ['yoga', 'meditation', 'stretch', 'pilates'],
  gym: ['gym', 'workout', 'fitness', 'exercise', 'training', 'lift'],
  movie: ['movie', 'cinema', 'film', 'theater', 'theatre'],
  party: ['party', 'celebrate', 'celebration', 'birthday', 'fiesta'],
  travel: ['travel', 'trip', 'explore', 'visit', 'tour', 'sightseeing'],
  food: ['food', 'eat', 'eating', 'cuisine', 'taste', 'foodie'],
  coffee: ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino'],
  dance: ['dance', 'dancing', 'salsa', 'club', 'nightclub'],
  swim: ['swim', 'swimming', 'pool'],
  bike: ['bike', 'biking', 'cycling', 'bicycle'],
  golf: ['golf', 'golfing'],
  ski: ['ski', 'skiing', 'snowboard', 'snow'],
  climb: ['climb', 'climbing', 'boulder', 'bouldering', 'rock climbing'],
};

const ACTIVITY_CONFIG: Record<string, { emoji: string; color: string }> = {
  surf: { emoji: '🏄', color: 'bg-blue-500/20' },
  run: { emoji: '🏃', color: 'bg-shake-coral/20' },
  hike: { emoji: '⛰️', color: 'bg-shake-green/20' },
  lunch: { emoji: '🍽️', color: 'bg-shake-coral/20' },
  dinner: { emoji: '🍝', color: 'bg-shake-purple/20' },
  drinks: { emoji: '🍹', color: 'bg-shake-teal/20' },
  'co-working': { emoji: '💻', color: 'bg-slate-500/20' },
  basketball: { emoji: '🏀', color: 'bg-shake-coral/20' },
  'tennis-padel': { emoji: '🎾', color: 'bg-shake-yellow/20' },
  football: { emoji: '⚽', color: 'bg-green-600/20' },
  shopping: { emoji: '🛍️', color: 'bg-pink-500/20' },
  arts: { emoji: '🎨', color: 'bg-purple-500/20' },
  concert: { emoji: '🎵', color: 'bg-pink-600/20' },
  yoga: { emoji: '🧘', color: 'bg-teal-500/20' },
  gym: { emoji: '💪', color: 'bg-red-500/20' },
  movie: { emoji: '🎬', color: 'bg-indigo-500/20' },
  party: { emoji: '🎉', color: 'bg-yellow-500/20' },
  travel: { emoji: '✈️', color: 'bg-sky-500/20' },
  food: { emoji: '🍕', color: 'bg-orange-500/20' },
  coffee: { emoji: '☕', color: 'bg-amber-600/20' },
  dance: { emoji: '💃', color: 'bg-fuchsia-500/20' },
  swim: { emoji: '🏊', color: 'bg-cyan-500/20' },
  bike: { emoji: '🚴', color: 'bg-lime-500/20' },
  golf: { emoji: '⛳', color: 'bg-emerald-500/20' },
  ski: { emoji: '⛷️', color: 'bg-blue-300/20' },
  climb: { emoji: '🧗', color: 'bg-stone-500/20' },
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
