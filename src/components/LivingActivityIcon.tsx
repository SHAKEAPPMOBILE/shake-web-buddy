interface LivingActivityIconProps {
  activityType: string;
  src: string | undefined;
  alt: string;
  /** "img" renders a plain <img>; "bg" renders a div with the image as a
   *  CSS background (for the bg-cover circular treatment PlanSwipeFeed
   *  uses on its auto-generated card). Both get the same overlay. */
  variant?: "img" | "bg";
  className?: string;
}

/** Dinner/brunch icon plus a small looping overlay — steam off the plate,
 *  yolk breaking on the egg — so the food reads as just-cooked instead of
 *  a static render. Every activity type other than dinner/brunch renders
 *  with no overlay at all. */
export function LivingActivityIcon({ activityType, src, alt, variant = "img", className }: LivingActivityIconProps) {
  const isDinner = activityType === "dinner";
  const isBrunch = activityType === "brunch";

  return (
    <div className="relative w-full h-full">
      {variant === "bg" ? (
        <div className={className} style={{ backgroundImage: `url(${src})` }} />
      ) : (
        <img src={src} alt={alt} className={className} />
      )}

      {isDinner && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="living-icon-steam living-icon-steam-1" d="M 44 52 C 40 44, 48 40, 44 32 C 40 24, 48 20, 45 12" />
          <path className="living-icon-steam living-icon-steam-2" d="M 54 50 C 58 43, 51 38, 55 30 C 59 22, 52 18, 55 9" />
          <path className="living-icon-steam living-icon-steam-3" d="M 49 54 C 45 47, 52 43, 48 35 C 44 27, 51 23, 49 15" />
        </svg>
      )}

      {isBrunch && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="living-icon-drip living-icon-drip-1">
            <svg viewBox="0 0 10 14"><path d="M5 0C5 0 0 7 0 10a5 5 0 0010 0C10 7 5 0 5 0z" /></svg>
          </div>
          <div className="living-icon-drip living-icon-drip-2">
            <svg viewBox="0 0 10 14"><path d="M5 0C5 0 0 7 0 10a5 5 0 0010 0C10 7 5 0 5 0z" /></svg>
          </div>
        </div>
      )}
    </div>
  );
}
