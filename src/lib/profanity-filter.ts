/**
 * Profanity filter for user-generated content
 * Checks for inappropriate language in activity descriptions
 */

// List of blocked words/patterns (lowercase)
const BLOCKED_WORDS = [
  // Explicit sexual terms
  "sex", "sexy", "porn", "porno", "xxx", "nude", "nudes", "naked",
  "blowjob", "handjob", "cumshot", "orgasm", "orgy", "erotic",
  "hooker", "prostitute", "escort",
  
  // Strong profanity
  "fuck", "fucker", "fucking", "fucked", "fck", "fuk",
  "shit", "shitting", "bullshit",
  "bitch", "bitches",
  "asshole", "arsehole",
  "cunt", "cunts",
  "dick", "dicks", "dickhead",
  "cock", "cocks",
  "pussy", "pussies",
  "whore", "whores",
  "slut", "sluts",
  "bastard", "bastards",
  
  // Slurs and hate speech
  "nigger", "nigga", "negro",
  "faggot", "fag", "faggy",
  "retard", "retarded",
  "tranny",
  "chink",
  "spic",
  "kike",
  
  // Drug references
  "cocaine", "heroin", "meth", "crack",
  
  // Violence
  "murder", "kill", "rape", "raping",
];

// Words that should only be blocked as whole words (not partial matches)
// to avoid false positives like "class" containing "ass"
const WHOLE_WORD_ONLY = [
  "ass", "cum", "ho", "hoe",
];

/**
 * Check if text contains profanity
 * @param text - The text to check
 * @returns Object with hasProfanity boolean and matched word if found
 */
export function checkProfanity(text: string): { hasProfanity: boolean; matchedWord?: string } {
  if (!text) return { hasProfanity: false };
  
  const lowerText = text.toLowerCase();
  
  // Check partial matches (blocked words can appear anywhere)
  for (const word of BLOCKED_WORDS) {
    if (lowerText.includes(word)) {
      return { hasProfanity: true, matchedWord: word };
    }
  }
  
  // Check whole word matches only (to avoid false positives)
  const words = lowerText.split(/\s+/);
  for (const word of WHOLE_WORD_ONLY) {
    if (words.includes(word)) {
      return { hasProfanity: true, matchedWord: word };
    }
  }
  
  return { hasProfanity: false };
}

/**
 * Sanitize text by removing or replacing profanity
 * (Alternative approach - currently not used, but available)
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  
  let result = text;
  const lowerText = text.toLowerCase();
  
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }
  
  return result;
}
