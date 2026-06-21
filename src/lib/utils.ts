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
