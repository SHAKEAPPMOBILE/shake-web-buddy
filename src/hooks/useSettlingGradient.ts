import { type CSSProperties, useEffect, useMemo, useState } from "react";

const ANIMATED_RAINBOW_GRADIENT = "linear-gradient(270deg, #f97316, #8b5cf6, #eab308, #ec4899, #22c55e, #3b82f6, #f97316)";

const SETTLED_GRADIENT_OPTIONS = [
  "#8b5cf6",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #f97316, #ec4899)",
  "linear-gradient(135deg, #22c55e, #3b82f6)",
  "linear-gradient(135deg, #eab308, #f97316)",
] as const;

const pageGradientRegistry = new Map<string, { background: string; refCount: number }>();

const animatedRainbowGradientStyle: CSSProperties = {
  background: ANIMATED_RAINBOW_GRADIENT,
  backgroundSize: "400% 400%",
  animation: "gradientShift 4s ease infinite",
};

function pickSettledGradient() {
  const index = Math.floor(Math.random() * SETTLED_GRADIENT_OPTIONS.length);
  return SETTLED_GRADIENT_OPTIONS[index];
}

function retainPageGradient(pageKey: string) {
  const existing = pageGradientRegistry.get(pageKey);
  if (existing) {
    existing.refCount += 1;
    return existing.background;
  }

  const background = pickSettledGradient();
  pageGradientRegistry.set(pageKey, { background, refCount: 1 });
  return background;
}

function releasePageGradient(pageKey: string) {
  const existing = pageGradientRegistry.get(pageKey);
  if (!existing) return;

  if (existing.refCount <= 1) {
    pageGradientRegistry.delete(pageKey);
    return;
  }

  existing.refCount -= 1;
}

interface UseSettlingGradientOptions {
  settleDelayMs?: number;
  alwaysAnimated?: boolean;
  /** When set, use this gradient as the settled state instead of the random picker. */
  fixedSettled?: string;
  /** Custom gradient used during the animation phase (defaults to the rainbow sweep). */
  animationGradient?: string;
}

export function useSettlingGradient(
  pageKey: string,
  {
    settleDelayMs = 2000,
    alwaysAnimated = false,
    fixedSettled,
    animationGradient,
  }: UseSettlingGradientOptions = {},
) {
  const [settledBackground] = useState(() => {
    if (alwaysAnimated) return null;
    if (fixedSettled) return fixedSettled;
    return retainPageGradient(pageKey);
  });
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (alwaysAnimated) {
      setIsAnimating(true);
      return;
    }

    setIsAnimating(true);
    const timeoutId = window.setTimeout(() => {
      setIsAnimating(false);
    }, settleDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
      // Only release registry slot for randomly-picked gradients.
      if (!fixedSettled) releasePageGradient(pageKey);
    };
  }, [alwaysAnimated, pageKey, settleDelayMs, fixedSettled]);

  const animatingStyle = useMemo<CSSProperties>(() => {
    const gradient = animationGradient ?? ANIMATED_RAINBOW_GRADIENT;
    return {
      background: gradient,
      backgroundSize: "400% 400%",
      animation: "gradientShift 4s ease infinite",
    };
  }, [animationGradient]);

  const style = useMemo<CSSProperties>(() => {
    if (alwaysAnimated || isAnimating || !settledBackground) {
      return animatingStyle;
    }

    return { background: settledBackground };
  }, [alwaysAnimated, isAnimating, settledBackground, animatingStyle]);

  return {
    isAnimating,
    settledBackground,
    style,
  };
}

export function getAnimatedRainbowGradientStyle(): CSSProperties {
  return animatedRainbowGradientStyle;
}
