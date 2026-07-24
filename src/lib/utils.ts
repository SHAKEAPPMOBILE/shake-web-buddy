import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse the numeric value out of a price_amount string.
 * price_amount is stored as a formatted string like "$25 USD" or "€10 EUR".
 * parseFloat("$25 USD") returns NaN — strip non-numeric chars first.
 * Returns 0 if the string has no numeric content.
 */
export function getPriceValue(priceAmount: string | null | undefined): number {
  if (!priceAmount) return 0;
  const match = priceAmount.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

/** Max length of the word getShareLabel pulls from a user-typed plan title. */
const MAX_SHARE_LABEL_WORD_LENGTH = 12;

/**
 * User-created plans carry their title in a free-text `note` field (e.g.
 * "Beach time?") rather than a fixed activity label. For share text/links,
 * use just its first word — capped so an unusually long word doesn't blow
 * out the message — falling back to the activity type's label when there's
 * no note (standard dinner/brunch/drinks plans).
 */
export function getShareLabel(note: string | null | undefined, fallbackLabel: string): string {
  const trimmed = note?.trim();
  if (!trimmed) return fallbackLabel;
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return fallbackLabel;
  return firstWord.length > MAX_SHARE_LABEL_WORD_LENGTH
    ? firstWord.slice(0, MAX_SHARE_LABEL_WORD_LENGTH)
    : firstWord;
}
