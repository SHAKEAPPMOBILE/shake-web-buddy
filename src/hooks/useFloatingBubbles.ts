import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export interface FloatingBubbleItem {
  id: string;
  /** Only used to keep bands in the same order as `items` — items should
   *  already be chronologically sorted (oldest first). */
  isMedia?: boolean;
}

interface Physics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
}

const FLOAT_SPEED = 42; // px/sec
const FLOAT_PAD = 6;
const BAND_HEIGHT_TEXT = 72;
const BAND_HEIGHT_MEDIA = 220;
const CULL_BUFFER = 400; // px above/below the viewport that still animate

/**
 * Floating "aquarium" bubbles: each item gets a fixed chronological vertical
 * band (oldest on top, like a normal list) and floats/bounces within it —
 * scrolling stays meaningful (older items are always further up) while every
 * bubble, visible or not, is a floating bubble. Tapping an item (via the
 * onClick from getBubbleProps) pins it in place; call suppressNextClick()
 * from a long-press/other gesture handler to swallow the trailing click that
 * gesture produces so it doesn't also toggle the pin.
 *
 * Physics for a bubble are spawned the moment its DOM node mounts (inside
 * registerBubbleEl, wired up by getBubbleProps' ref), not in a separate
 * effect keyed off `items` — an effect-based approach can race against
 * whatever async gate/loading state sits in front of the container mounting
 * (e.g. an invite gate), miss the container while it's null, and never get
 * a reason to fire again once it does mount — leaving bubbles stuck at
 * their CSS default position, piled on top of each other.
 */
export function useFloatingBubbles(
  items: FloatingBubbleItem[],
  containerRef: RefObject<HTMLElement>
) {
  const bandLayout = useMemo(() => {
    const bands = new Map<string, { top: number; height: number }>();
    let cursor = 0;
    items.forEach((item) => {
      const height = item.isMedia ? BAND_HEIGHT_MEDIA : BAND_HEIGHT_TEXT;
      bands.set(item.id, { top: cursor, height });
      cursor += height;
    });
    return { bands, totalHeight: cursor };
  }, [items]);
  const bandLayoutRef = useRef(bandLayout);
  bandLayoutRef.current = bandLayout;

  const [pinnedIds, setPinnedIds] = useState<Record<string, boolean>>({});
  const pinnedIdsRef = useRef<Record<string, boolean>>({});
  useEffect(() => { pinnedIdsRef.current = pinnedIds; }, [pinnedIds]);

  const physicsRef = useRef<Map<string, Physics>>(new Map());
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const suppressClickRef = useRef(false);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const randomVelocity = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    return { vx: Math.cos(angle) * FLOAT_SPEED, vy: Math.sin(angle) * FLOAT_SPEED };
  }, []);

  const registerBubbleEl = useCallback((id: string, el: HTMLDivElement | null) => {
    const prev = elsRef.current.get(id);
    if (prev && prev !== el && resizeObserverRef.current) {
      resizeObserverRef.current.unobserve(prev);
    }
    if (!el) {
      elsRef.current.delete(id);
      return;
    }
    elsRef.current.set(id, el);
    resizeObserverRef.current?.observe(el);

    let physics = physicsRef.current.get(id);
    if (!physics) {
      const tank = containerRef.current;
      const tw = tank?.clientWidth || 300;
      const band = bandLayoutRef.current.bands.get(id) ?? { top: 0, height: BAND_HEIGHT_TEXT };
      const w = el.offsetWidth || 90;
      const h = el.offsetHeight || 44;
      const v = randomVelocity();
      physics = {
        x: Math.random() * Math.max(1, tw - w - FLOAT_PAD * 2) + FLOAT_PAD,
        y: band.top + Math.random() * Math.max(1, band.height - h - FLOAT_PAD * 2) + FLOAT_PAD,
        vx: v.vx, vy: v.vy, w, h,
      };
      physicsRef.current.set(id, physics);
    }
    el.style.transform = `translate3d(${physics.x}px, ${physics.y}px, 0)`;
  }, [containerRef, randomVelocity]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const wasPinned = !!prev[id];
      const next = { ...prev };
      if (wasPinned) delete next[id];
      else next[id] = true;

      const physics = physicsRef.current.get(id);
      if (physics) {
        if (wasPinned) {
          const v = randomVelocity();
          physics.vx = v.vx;
          physics.vy = v.vy;
        } else {
          physics.vx = 0;
          physics.vy = 0;
        }
      }
      return next;
    });
  }, [randomVelocity]);

  const handleClick = useCallback((id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    togglePin(id);
  }, [togglePin]);

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
  }, []);

  // Shared ResizeObserver — keeps each bubble's collision box in sync as
  // pin-reveal, reaction pills, or media load change its rendered size.
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.bubbleId;
        if (!id) continue;
        const physics = physicsRef.current.get(id);
        if (!physics) continue;
        physics.w = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        physics.h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      }
    });
    resizeObserverRef.current = observer;
    elsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Drop physics state for items that no longer exist.
  useEffect(() => {
    const liveIds = new Set(items.map((i) => i.id));
    Array.from(physicsRef.current.keys()).forEach((id) => {
      if (!liveIds.has(id)) physicsRef.current.delete(id);
    });
  }, [items]);

  // Float/bounce/separation loop. Always running (even under reduced
  // motion) so overlap separation and the transform write always happen —
  // under reduced motion we just skip the velocity-driven drift.
  useEffect(() => {
    let raf = 0;
    let lastT: number | null = null;

    const tick = (t: number) => {
      const tank = containerRef.current;
      if (!tank) { raf = requestAnimationFrame(tick); return; }
      if (lastT === null) lastT = t;
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      const tw = tank.clientWidth;
      const scrollTop = tank.scrollTop;
      const viewTop = scrollTop - CULL_BUFFER;
      const viewBottom = scrollTop + tank.clientHeight + CULL_BUFFER;

      const entries = Array.from(physicsRef.current.entries()).filter(([id, b]) => {
        const band = bandLayoutRef.current.bands.get(id);
        const bandBottom = band ? band.top + band.height : b.y + b.h;
        const bandTop = band ? band.top : b.y;
        return bandBottom >= viewTop && bandTop <= viewBottom;
      });

      if (!reducedMotion) {
        entries.forEach(([id, b]) => {
          if (pinnedIdsRef.current[id]) return;
          const band = bandLayoutRef.current.bands.get(id);
          const bandTop = band ? band.top : 0;
          const bandBottom = band ? band.top + band.height : tank.scrollHeight;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < FLOAT_PAD) { b.x = FLOAT_PAD; b.vx = Math.abs(b.vx); }
          if (b.x + b.w > tw - FLOAT_PAD) { b.x = tw - FLOAT_PAD - b.w; b.vx = -Math.abs(b.vx); }
          if (b.y < bandTop + FLOAT_PAD) { b.y = bandTop + FLOAT_PAD; b.vy = Math.abs(b.vy); }
          if (b.y + b.h > bandBottom - FLOAT_PAD) { b.y = bandBottom - FLOAT_PAD - b.h; b.vy = -Math.abs(b.vy); }
        });
      }

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [idA, a] = entries[i];
          const [idB, b] = entries[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (overlapX > 0 && overlapY > 0) {
            const pushX = overlapX / 2, pushY = overlapY / 2;
            const dirX = (a.x + a.w / 2) < (b.x + b.w / 2) ? -1 : 1;
            const dirY = (a.y + a.h / 2) < (b.y + b.h / 2) ? -1 : 1;
            if (!pinnedIdsRef.current[idA]) { a.x += dirX * pushX * 0.5; a.y += dirY * pushY * 0.5; }
            if (!pinnedIdsRef.current[idB]) { b.x -= dirX * pushX * 0.5; b.y -= dirY * pushY * 0.5; }
          }
        }
      }

      entries.forEach(([id, b]) => {
        const el = elsRef.current.get(id);
        if (el) el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, containerRef]);

  const isPinned = useCallback((id: string) => !!pinnedIds[id], [pinnedIds]);

  // Positioning props — spread onto the element that should float (the
  // outer wrapper, typically).
  const getBubbleProps = useCallback((id: string) => ({
    ref: (el: HTMLDivElement | null) => registerBubbleEl(id, el),
    "data-bubble-id": id,
    style: { position: "absolute" as const, top: 0, left: 0 },
  }), [registerBubbleEl]);

  // Tap-to-pin handler — wire onto whatever element should be the tap
  // target (may be a nested element, not the floating wrapper itself).
  const getClickHandler = useCallback((id: string) => () => handleClick(id), [handleClick]);

  return {
    canvasHeight: bandLayout.totalHeight,
    isPinned,
    togglePin,
    getBubbleProps,
    getClickHandler,
    suppressNextClick,
  };
}

export type UseFloatingBubblesResult = ReturnType<typeof useFloatingBubbles>;
