/** Illustrated landmark backgrounds for the standing Dinner/Brunch cards in
 *  the swipe feed — replaces the plain white behind the activity-type
 *  circle with something that reads as "this city" at a glance. Keyed by
 *  the exact `city` string used elsewhere (must match SHAKE_CITIES' name).
 *  Cities with no illustration yet just keep the plain white background. */
export const CITY_BACKGROUNDS: Record<string, string> = {
  "New York City": "/icons/cities/new-york-city.webp",
  "Lisbon": "/icons/cities/lisbon.webp",
  "San Francisco": "/icons/cities/san-francisco.webp",
  "Los Angeles": "/icons/cities/los-angeles.webp",
  "Dallas": "/icons/cities/dallas.webp",
  "Austin": "/icons/cities/austin.webp",
  "London": "/icons/cities/london.webp",
  "Guadalajara": "/icons/cities/guadalajara.webp",
  "Chicago": "/icons/cities/chicago.webp",
  "Toronto": "/icons/cities/toronto.webp",
  "Vancouver": "/icons/cities/vancouver.webp",
  "Mexico City": "/icons/cities/mexico-city.webp",
  "Miami": "/icons/cities/miami.webp",
  "Bogotá": "/icons/cities/bogota.webp",
  "Cartagena": "/icons/cities/cartagena.webp",
  "Buenos Aires": "/icons/cities/buenos-aires.webp",
  "Paris": "/icons/cities/paris.webp",
  "Berlin": "/icons/cities/berlin.webp",
  "Madrid": "/icons/cities/madrid.webp",
  "Barcelona": "/icons/cities/barcelona.webp",
  "Porto": "/icons/cities/porto.webp",
  "Dubai": "/icons/cities/dubai.png",
};

export function getCityBackground(city: string | null | undefined): string | undefined {
  if (!city) return undefined;
  return CITY_BACKGROUNDS[city];
}
