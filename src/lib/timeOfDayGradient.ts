/**
 * A soft, low-opacity wash rather than a solid color block — fades out
 * gradually over a wider distance so there's no visible edge where it
 * ends, just a faint tint that's barely there. Shared by every screen
 * that wants the same day/night-of-day top band (create-plan page, home).
 */
export function getTimeOfDayGradient(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) {
    // Sunrise — warm peach wash
    return "linear-gradient(180deg, rgba(255,217,160,0.35) 0%, rgba(255,217,160,0.12) 6%, rgba(255,255,255,0) 16%, #FFFFFF 100%)";
  }
  if (hour >= 11 && hour < 17) {
    // Midday — sky-blue wash
    return "linear-gradient(180deg, rgba(168,216,240,0.35) 0%, rgba(168,216,240,0.12) 6%, rgba(255,255,255,0) 16%, #FFFFFF 100%)";
  }
  if (hour >= 17 && hour < 20) {
    // Sunset — orange/pink wash
    return "linear-gradient(180deg, rgba(255,154,118,0.35) 0%, rgba(255,154,118,0.12) 6%, rgba(255,255,255,0) 16%, #FFFFFF 100%)";
  }
  // Night — indigo/violet wash
  return "linear-gradient(180deg, rgba(107,91,149,0.35) 0%, rgba(107,91,149,0.12) 6%, rgba(255,255,255,0) 16%, #FFFFFF 100%)";
}
