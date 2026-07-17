import { useEffect, RefObject } from "react";

/**
 * Fixes a WKWebView/Capacitor quirk where a freshly-mounted overflow-y-auto
 * scroll container (reached via client-side navigation rather than a fresh
 * page load) can take a few seconds before iOS recognizes it as scrollable —
 * touches land but nothing moves until the OS "catches up" on its own.
 *
 * Forcing a synchronous 1px scroll-and-back on mount makes WKWebView
 * register the container's scrollability immediately instead of waiting.
 * Paired with the global `-webkit-overflow-scrolling: touch` rule in
 * index.css (which handles the momentum-scroll compositor path); this hook
 * is the extra nudge for the very first touch right after mount.
 *
 * Usage: const ref = useRef<HTMLDivElement>(null); useScrollNudge(ref);
 */
export function useScrollNudge(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
    });
    return () => cancelAnimationFrame(id);
  }, [ref]);
}
