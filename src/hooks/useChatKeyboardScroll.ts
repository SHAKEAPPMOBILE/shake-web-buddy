import { useEffect } from "react";

/**
 * Re-scrolls a chat to the bottom whenever the on-screen keyboard opens or
 * closes. Fires via requestAnimationFrame so the scroll happens AFTER the
 * keyboard animation (and viewport resize) has settled — not before.
 *
 * Capacitor sets Keyboard.resize = 'native', which shrinks the WKWebView
 * viewport as the keyboard slides in (~250 ms). Plain useEffect fires before
 * that animation completes, so the scroll lands at the wrong position.
 * The visualViewport 'resize' event fires when the viewport has actually
 * stabilised, making it the correct trigger for a post-keyboard scroll.
 *
 * Usage:
 *   const scrollToBottom = useCallback(() => { ... }, []);
 *   useChatKeyboardScroll(scrollToBottom);
 */
export function useChatKeyboardScroll(scrollToBottom: () => void) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: number;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(scrollToBottom);
    };

    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, [scrollToBottom]);
}
