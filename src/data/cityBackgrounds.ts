import { PLAN_BACKGROUNDS, type PlanBackground } from "@/data/planBackgrounds";

/** City photos behind the standing Dinner/Brunch cards in the swipe feed — they replaced the
 *  black-and-white landmark illustrations that used to sit here. Keyed by the exact `city`
 *  string used elsewhere (must match SHAKE_CITIES' name); values are ids in PLAN_BACKGROUNDS,
 *  so each photo, its focal point and its credit live in one place. A city with no photo just
 *  keeps the plain time-of-day wash. */
const CITY_PHOTO_IDS: Record<string, string> = {
  "Medellín": "city-medellin",
  "Washington D.C.": "city-washington-dc",
  "New York City": "city-new-york-city",
  "Lisbon": "city-lisbon",
  "San Francisco": "city-san-francisco",
  "Los Angeles": "city-los-angeles",
  "Dallas": "city-dallas",
  "Austin": "city-austin",
  "London": "city-london",
  "Guadalajara": "city-guadalajara",
  "Chicago": "city-chicago",
  "Toronto": "city-toronto",
  "Vancouver": "city-vancouver",
  "Mexico City": "city-mexico-city",
  "Miami": "city-miami",
  "Bogotá": "city-bogota",
  "Cartagena": "city-cartagena",
  "Buenos Aires": "city-buenos-aires",
  "Paris": "city-paris",
  "Berlin": "city-berlin",
  "Madrid": "city-madrid",
  "Barcelona": "city-barcelona",
  "Porto": "city-porto",
  "Dubai": "city-dubai",
};

export function getCityPhoto(city: string | null | undefined): PlanBackground | undefined {
  if (!city) return undefined;
  const id = CITY_PHOTO_IDS[city];
  return id ? PLAN_BACKGROUNDS.find((b) => b.id === id) : undefined;
}
