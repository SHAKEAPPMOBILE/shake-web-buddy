import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a chat scrolled to its newest message while its layout settles, as long as the person
 * hasn't scrolled up to read something.
 *
 * Chats scroll to the bottom when messages load, but the real height of long messages and media is
 * only measured a moment later (useFloatingBubbles) — and the header curtain / keyboard can resize
 * the list after that. Each of those leaves the bottom cut off. This follows `trigger` (e.g. the
 * list's canvas height) and the container's own size, and re-scrolls whenever the person is still
 * at the bottom. Scrolling up, even a little, stops it; scrolling back down resumes it.
 */
export function useStickToBottom(ref: RefObject<HTMLElement>, trigger: unknown) {
  const stuck = useRef(true);
  const attachedTo = useRef<HTMLElement | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const scrollDown = () => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // The scroll area can appear after the first render (a loading or invite screen comes first), so
  // this checks on every render and attaches as soon as the element exists or changes.
  useEffect(() => {
    const el = ref.current;
    if (el === attachedTo.current) return;
    detach.current?.();
    detach.current = null;
    attachedTo.current = el;
    if (!el) return;
    const onScroll = () => {
      stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => { if (stuck.current) scrollDown(); });
      observer.observe(el);
    }
    stuck.current = true;
    detach.current = () => {
      el.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  });

  useEffect(() => () => { detach.current?.(); detach.current = null; }, []);

  useLayoutEffect(() => {
    if (stuck.current) scrollDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
