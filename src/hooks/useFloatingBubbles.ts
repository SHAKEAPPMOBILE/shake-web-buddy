import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";

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
  /** Once a bubble has been thrown, it's no longer confined to its own
   *  chronological band — it bounces around the whole tank instead. Re-
   *  confining it on release would snap it right back where it came from,
   *  which defeats the point of throwing it. */
  escaped?: boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startBubbleX: number;
  startBubbleY: number;
  samples: { x: number; y: number; t: number }[];
  dragging: boolean;
}

const FLOAT_SPEED = 42; // px/sec, ambient drift
const FLOAT_PAD = 6;
const BAND_HEIGHT_TEXT = 72;
const BAND_HEIGHT_MEDIA = 220;
const CULL_BUFFER = 400; // px above/below the viewport that still animate
const PIN_DURATION_MS = 10000;
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag, not a tap
const THROW_MAX_SPEED = 900; // px/sec — clamp so a hard fling doesn't break the sim
const VELOCITY_SAMPLE_WINDOW = 6;

/**
 * Floating "aquarium" bubbles: each item gets a fixed chronological vertical
 * band (oldest on top, like a normal list) and floats/bounces within it —
 * scrolling stays meaningful (older items are always further up) while every
 * bubble, on screen or not, is a floating bubble.
 *
 * Tap a bubble to pin it (freezes it, and is exclusive — pinning one
 * un-pins whatever was pinned before, and auto-unpins itself after 10s).
 * Press-and-drag a bubble to fling it — release velocity carries over, and a
 * thrown bubble bounces around the whole tank instead of staying confined
 * to its own band.
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

  // Exclusive pin: only one bubble pinned at a time, auto-clears after
  // PIN_DURATION_MS. Picking a new one immediately resumes the old one.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const pinnedIdRef = useRef<string | null>(null);
  useEffect(() => { pinnedIdRef.current = pinnedId; }, [pinnedId]);
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const physicsRef = useRef<Map<string, Physics>>(new Map());
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<Map<string, DragState>>(new Map());
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

  const resumeFloating = useCallback((id: string) => {
    const physics = physicsRef.current.get(id);
    if (!physics) return;
    const v = randomVelocity();
    physics.vx = v.vx;
    physics.vy = v.vy;
  }, [randomVelocity]);

  const clearPin = useCallback(() => {
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    const id = pinnedIdRef.current;
    setPinnedId(null);
    if (id) resumeFloating(id);
  }, [resumeFloating]);

  const pinBubble = useCallback((id: string) => {
    if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    const prevId = pinnedIdRef.current;
    if (prevId && prevId !== id) resumeFloating(prevId);

    setPinnedId(id);
    const physics = physicsRef.current.get(id);
    if (physics) { physics.vx = 0; physics.vy = 0; }

    pinTimeoutRef.current = setTimeout(() => { clearPin(); }, PIN_DURATION_MS);
  }, [resumeFloating, clearPin]);

  useEffect(() => () => { if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current); }, []);

  // Tap the tank background (not a bubble) to calm everything back down to
  // ambient drift speed — an escape hatch after flinging bubbles around.
  // Leaves pinned/dragged bubbles alone and doesn't force escaped bubbles
  // back into their band (that would snap them there instantly, which is
  // the opposite of "calm").
  const calmDown = useCallback(() => {
    physicsRef.current.forEach((physics, id) => {
      if (id === pinnedIdRef.current) return;
      if (dragRef.current.has(id)) return;
      const v = randomVelocity();
      physics.vx = v.vx;
      physics.vy = v.vy;
    });
  }, [randomVelocity]);

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
    if (pinnedIdRef.current === id) clearPin();
    else pinBubble(id);
  }, [clearPin, pinBubble]);

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

  // ── Press-and-drag to throw ────────────────────────────────────────────
  const handlePointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const physics = physicsRef.current.get(id);
    if (!physics) return;
    dragRef.current.set(id, {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startBubbleX: physics.x,
      startBubbleY: physics.y,
      samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
      dragging: false,
    });
  }, []);

  const handlePointerMove = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current.get(id);
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.dragging = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* no-op */ }
      suppressClickRef.current = true;
      if (pinnedIdRef.current === id) clearPin();
    }

    if (drag.dragging) {
      const physics = physicsRef.current.get(id);
      if (physics) {
        physics.x = drag.startBubbleX + dx;
        physics.y = drag.startBubbleY + dy;
        const el = elsRef.current.get(id);
        if (el) el.style.transform = `translate3d(${physics.x}px, ${physics.y}px, 0)`;
      }
      drag.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (drag.samples.length > VELOCITY_SAMPLE_WINDOW) drag.samples.shift();
    }
  }, [clearPin]);

  const endDrag = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current.get(id);
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current.delete(id);
    if (!drag.dragging) return; // plain tap/click — handled separately

    const physics = physicsRef.current.get(id);
    if (!physics) return;
    const samples = drag.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(1, last.t - first.t) / 1000;
    let vx = (last.x - first.x) / dt;
    let vy = (last.y - first.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed > THROW_MAX_SPEED) {
      const scale = THROW_MAX_SPEED / speed;
      vx *= scale;
      vy *= scale;
    }
    physics.vx = vx;
    physics.vy = vy;
    physics.escaped = true;
  }, []);

  const handlePointerUp = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    endDrag(id, e);
  }, [endDrag]);

  const handlePointerCancel = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    dragRef.current.delete(id);
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
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + tank.clientHeight;
      const viewTop = scrollTop - CULL_BUFFER;
      const viewBottom = scrollTop + tank.clientHeight + CULL_BUFFER;

      const entries = Array.from(physicsRef.current.entries()).filter(([id, b]) => {
        // Escaped (thrown) and actively-dragged bubbles are always kept live —
        // they're bounded to the current viewport below, so they can never
        // actually be outside the culled range; this is just a defensive
        // belt-and-suspenders so a thrown bubble is never "abandoned" mid-flight.
        if (dragRef.current.has(id) || b.escaped) return true;
        const band = bandLayoutRef.current.bands.get(id);
        const bandBottom = band ? band.top + band.height : b.y + b.h;
        const bandTop = band ? band.top : b.y;
        return bandBottom >= viewTop && bandTop <= viewBottom;
      });

      if (!reducedMotion) {
        entries.forEach(([id, b]) => {
          if (id === pinnedIdRef.current) return;
          if (dragRef.current.has(id)) return; // being manually dragged this frame
          const band = bandLayoutRef.current.bands.get(id);
          // A thrown bubble bounces within the CURRENT viewport (not the full,
          // possibly much taller, canvas) so it's always visible without
          // having to scroll to find it — and stays visible even as the user
          // scrolls, since this is recomputed from live scrollTop every frame.
          const bandTop = b.escaped ? viewportTop : band ? band.top : 0;
          const bandBottom = b.escaped ? viewportBottom : band ? band.top + band.height : viewportBottom;
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
            if (idA !== pinnedIdRef.current && !dragRef.current.has(idA)) { a.x += dirX * pushX * 0.5; a.y += dirY * pushY * 0.5; }
            if (idB !== pinnedIdRef.current && !dragRef.current.has(idB)) { b.x -= dirX * pushX * 0.5; b.y -= dirY * pushY * 0.5; }
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

  const isPinned = useCallback((id: string) => pinnedId === id, [pinnedId]);

  // Positioning + drag-to-throw props — spread onto the element that should
  // float (the outer wrapper, typically).
  const getBubbleProps = useCallback((id: string) => ({
    ref: (el: HTMLDivElement | null) => registerBubbleEl(id, el),
    "data-bubble-id": id,
    style: { position: "absolute" as const, top: 0, left: 0, touchAction: "none" as const },
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => handlePointerDown(id, e),
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => handlePointerMove(id, e),
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => handlePointerUp(id, e),
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => handlePointerCancel(id, e),
  }), [registerBubbleEl, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);

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
    calmDown,
  };
}

export type UseFloatingBubblesResult = ReturnType<typeof useFloatingBubbles>;
