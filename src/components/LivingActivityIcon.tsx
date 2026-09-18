import { cn } from "@/lib/utils";

interface LivingActivityIconProps {
  activityType: string;
  src: string | undefined;
  alt: string;
  /** "img" renders a plain <img>; "bg" renders a div with the image as a
   *  CSS background (for the bg-cover circular treatment PlanSwipeFeed
   *  uses on its auto-generated card). Both get the same overlay. */
  variant?: "img" | "bg";
  className?: string;
  /** Classes for the clipping frame around the image itself (e.g.
   *  "rounded-full overflow-hidden"). Deliberately separate from the
   *  outer wrapper so the steam/drip overlay can rise or fall past the
   *  icon's own bounds instead of being clipped along with the photo. */
  frameClassName?: string;
}

/** Dinner/brunch icon plus a small looping overlay — steam off the plate,
 *  yolk breaking on the egg — so the food reads as just-cooked instead of
 *  a static render. Every activity type other than dinner/brunch renders
 *  with no overlay at all. The overlay deliberately escapes the icon's own
 *  circle/frame (steam rises past the top, the drip falls past the bottom)
 *  — only the base photo is clipped, via frameClassName. */
export function LivingActivityIcon({ activityType, src, alt, variant = "img", className, frameClassName }: LivingActivityIconProps) {
  const isDinner = activityType === "dinner";
  const isBrunch = activityType === "brunch";

  return (
    <div className="relative w-full h-full">
      <div className={cn("w-full h-full", frameClassName)}>
        {variant === "bg" ? (
          <div className={className} style={{ backgroundImage: `url(${src})` }} />
        ) : (
          <img src={src} alt={alt} className={className} />
        )}
      </div>

      {isDinner && (
        <svg
          className="living-icon-steam-svg absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="living-icon-steam living-icon-steam-1" d="M 44 50 C 40 38, 48 32, 44 20 C 40 8, 48 0, 45 -14" />
          <path className="living-icon-steam living-icon-steam-2" d="M 54 48 C 58 37, 51 30, 55 18 C 59 6, 52 -2, 55 -16" />
          <path className="living-icon-steam living-icon-steam-3" d="M 49 52 C 45 42, 52 34, 48 22 C 44 10, 51 2, 49 -12" />
        </svg>
      )}

      {isBrunch && (
        <div className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden="true">
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
