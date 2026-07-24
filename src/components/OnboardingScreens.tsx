import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import screen1 from "@/assets/onboarding/screen_1cat.png";
import screen2 from "@/assets/onboarding/screen_2god.png";
import screen3 from "@/assets/onboarding/screen_3man.png";

interface OnboardingScreensProps {
  onComplete: () => void | Promise<void>;
  userName?: string | null;
}

const SCREENS = [
  {
    image: screen1,
    headline: "Discover plans near you",
    subtext:
      "Browse dinners, brunches, and video-proposed plans happening in your city — or anywhere in the world.",
  },
  {
    image: screen2,
    headline: "Chat, then meet",
    subtext:
      "Reply to specific messages, coordinate the details, and lock in the plan — all in one thread.",
  },
  {
    image: screen3,
    headline: "Enjoy your hang-out",
    subtext:
      "See who's joining, what's planned, and where — then go!",
  },
];

/** Minimum horizontal drag (px) to register as a swipe. */
const SWIPE_THRESHOLD = 40;

export function OnboardingScreens({ onComplete, userName }: OnboardingScreensProps) {
  const [current, setCurrent] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const isLast = current === SCREENS.length - 1;
  const firstName = userName?.trim().split(/\s+/)[0] || null;

  const goTo = (index: number) => {
    if (index >= 0 && index < SCREENS.length) setCurrent(index);
  };

  const handleNext = async () => {
    if (!isLast) {
      setCurrent((c) => c + 1);
    } else {
      await onComplete();
    }
  };

  // Pointer-based swipe (works for both touch and mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const delta = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) goTo(current + 1); // swipe left  → next
    else goTo(current - 1);           // swipe right → prev
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center select-none overflow-y-auto"
      // Matches the mockups' own baked-in background (rgb(242,241,236),
      // sampled directly from the source PNGs) exactly, so there's no
      // visible seam where the transparent-edged illustration meets the
      // page background.
      style={{ background: "#F2F1EC" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Centered mobile-width column — on a wide desktop viewport this keeps
          the illustration at its natural proportions instead of stretching
          full-bleed, which is what was over-zooming/cropping it. */}
      <div className="w-full max-w-md flex flex-col flex-1">
        {/* Illustration area. The source mockups are 900×1900 with the
            illustration occupying the top 820px (~43%) and the rest baked-in
            text/dots/button below it — aspect-ratio (not a fixed vh height)
            is what makes object-cover crop exactly that boundary regardless
            of viewport width, so it doesn't double up with the live text/
            controls rendered below. */}
        <div
          className="relative overflow-hidden w-full shrink-0"
          style={{ aspectRatio: "900 / 820" }}
        >
          {SCREENS.map((s, i) => (
            <img
              key={i}
              src={s.image}
              alt=""
              draggable={false}
              className={cn(
                "absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500",
                i === current ? "opacity-100" : "opacity-0"
              )}
            />
          ))}
        </div>

      {/* Text + controls — sits on the same warm background as the illustration */}
      <div
        className="flex-1 flex flex-col px-8 pt-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 2rem)" }}
      >
        {/* Headline + subtext — fixed min-height so dots/button don't jump */}
        <div className="flex-1">
          <h1
            key={`h-${current}`}
            className="text-[1.75rem] font-bold leading-tight text-gray-900 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {firstName ? `${SCREENS[current].headline}, ${firstName}!` : SCREENS[current].headline}
          </h1>
          <p
            key={`p-${current}`}
            className="text-base text-gray-500 leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {SCREENS[current].subtext}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-5">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to screen ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === current ? "w-6 bg-gray-900" : "w-2 bg-gray-900/25"
              )}
            />
          ))}
        </div>

        {/* CTA button — purple to match the mockup */}
        <button
          onClick={handleNext}
          className="w-full h-14 rounded-full text-base font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: "linear-gradient(to right, #6D28D9, #4F46E5)" }}
        >
          {isLast ? "Get Started" : "Continue"}
        </button>
      </div>
      </div>
    </div>
  );
}
