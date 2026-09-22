/** RGB triplet for the current hour's tint — sunrise peach, midday sky-blue,
 *  sunset orange/pink, or night indigo/violet. */
function getTimeOfDayTint(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "255,217,160";
  if (hour >= 11 && hour < 17) return "168,216,240";
  if (hour >= 17 && hour < 20) return "255,154,118";
  return "107,91,149";
}

/**
 * A soft, low-opacity wash rather than a solid color block — fades out
 * gradually over a wider distance so there's no visible edge where it
 * ends, just a faint tint that's barely there. Shared by every screen
 * that wants the same day/night-of-day band (create-plan page, home,
 * the plan swipe feed's card background).
 *
 * The third stop is opaque #FFFFFF, not rgba(255,255,255,0) — the tint
 * itself fades out by then, but the background stays fully solid white
 * the rest of the way down. Using a transparent white there instead once
 * left the page ~60-90% see-through from 16% to 100%, invisible on a
 * plain in-flow background but exposing whatever sits behind any
 * backdrop-blur layer using this gradient (e.g. HomeTab's overlay).
 *
 * @param edge Which edge the tint sits at — "top" (default, used by Home)
 *   or "bottom" (used by the swipe feed card, whose own text sits low).
 */
export function getTimeOfDayGradient(edge: "top" | "bottom" = "top"): string {
  const tint = getTimeOfDayTint();
  const angle = edge === "top" ? 180 : 0;
  return `linear-gradient(${angle}deg, rgba(${tint},0.35) 0%, rgba(${tint},0.12) 6%, #FFFFFF 16%, #FFFFFF 100%)`;
}
