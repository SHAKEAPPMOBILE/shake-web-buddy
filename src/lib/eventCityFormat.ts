/**
 * Normalize city strings for external event APIs (Ticketmaster, Eventbrite, etc.).
 */

/** Remove trailing ", USA", ", United Kingdom", etc. from display strings. */
export function stripCountrySuffixFromCityName(city: string): string {
  const t = city.trim();
  const i = t.indexOf(",");
  if (i === -1) return t;
  return t.slice(0, i).trim();
}

/**
 * Ticketmaster Discovery often matches shorter municipal names than our SHAKE list
 * (e.g. "New York" instead of "New York City").
 */
const TICKETMASTER_CITY_ALIASES: Record<string, string> = {
  "new york city": "New York",
  "washington d.c.": "Washington",
};

export function toTicketmasterCityName(shakeCityName: string): string {
  const base = stripCountrySuffixFromCityName(shakeCityName);
  const key = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return TICKETMASTER_CITY_ALIASES[key] ?? base;
}
