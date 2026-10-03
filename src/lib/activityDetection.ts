// Activity detection from user text input
// Maps keywords to activity types for automatic categorization

import { findEmojiForText } from "@/lib/emojiSearch";
import { getActivityById } from "@/data/activityTypes";

interface ActivityMatch {
  type: string;
  emoji: string;
  color: string;
}

// Activity types with their own illustrated icon, matched on whole words (so "bar" doesn't fire on
// "barbecue" or "bike" on "bikini") in English and Spanish. Anything else falls through to the emoji
// search in emojiSearch.ts.
const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  brunch: ['brunch'],
  dinner: ['dinner', 'supper', 'evening meal', 'restaurant', 'cena', 'restaurante'],
  drinks: ['drinks', 'drink', 'bar', 'pub', 'cocktail', 'beer', 'wine', 'happy hour', 'tragos', 'trago', 'cerveza', 'vino', 'coctel', 'cocteles'],
  yoga: ['yoga'],
  picnic: ['picnic'],
  coffee: ['coffee', 'cafe', 'espresso', 'latte', 'cafecito'],
  beach: ['beach', 'beach day', 'playa'],
  movie: ['movie', 'cinema', 'film night', 'movie night', 'cine', 'pelicula'],
  karaoke: ['karaoke'],
  gaming: ['gaming', 'video game', 'video games', 'game night', 'videojuegos', 'videojuego', 'playstation', 'xbox'],
  museum: ['museum', 'gallery', 'exhibit', 'exhibition', 'museo', 'galeria', 'exposicion'],
  bike: ['bike ride', 'bike', 'biking', 'cycling', 'bici', 'bicicleta', 'ciclismo'],
  surf: ['surf', 'surfing'],
};

const normalizeText = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Built once: one whole-word regex per type (optional plural), over accent-free text.
const KEYWORD_MATCHERS: [string, RegExp][] = Object.entries(ACTIVITY_KEYWORDS).map(([type, kws]) => [
  type,
  new RegExp(`\\b(?:${kws.map((k) => normalizeText(k).replace(/ /g, ' ')).join('|')})(?:s|es)?\\b`),
]);

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
  const normalized = normalizeText(text);

  for (const [activityType, matcher] of KEYWORD_MATCHERS) {
    if (matcher.test(normalized)) {
      const config = ACTIVITY_CONFIG[activityType] || ACTIVITY_CONFIG.default;
      return { type: activityType, emoji: config.emoji, color: config.color };
    }
  }

  // No illustrated-icon type: look for any emoji that fits what they said ("ping pong" → 🏓). The
  // type stays "general" (nothing downstream treats it as a standing activity), but the emoji is real.
  return {
    type: 'general',
    emoji: findEmojiForText(text) ?? ACTIVITY_CONFIG.default.emoji,
    color: ACTIVITY_CONFIG.default.color,
  };
}

/** The emoji for a saved plan: its activity type's, or — for "general" plans — whatever its title says. */
export function getPlanEmoji(activityType: string | null | undefined, note: string | null | undefined): string {
  const known = activityType ? getActivityById(activityType) : undefined;
  if (known) return known.emoji;
  return detectActivityFromText(note ?? '').emoji;
}

/**
 * Gets the activity config for a known type
 */
export function getActivityConfig(type: string): { emoji: string; color: string } {
  return ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
}
