import { useState, useEffect, useCallback, useRef, type PointerEvent } from "react";

/**
 * Long-press opens mobile reaction bar; desktop uses CSS group-hover on the message row.
 */
export function useMessageReactionBarState(reactionsEnabled: boolean) {
  const [reactionBarMessageId, setReactionBarMessageId] = useState<string | null>(null);
  const mobileReactionBarRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressMessageIdRef = useRef<string | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressMessageIdRef.current = null;
  }, []);

  const onMessagePointerDown = useCallback(
    (messageId: string) => (e: PointerEvent) => {
      if (e.button !== 0 || !reactionsEnabled) return;
      clearLongPressTimer();
      longPressMessageIdRef.current = messageId;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        setReactionBarMessageId(messageId);
      }, 480);
    },
    [reactionsEnabled, clearLongPressTimer]
  );

  const onMessagePointerEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!reactionBarMessageId) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (mobileReactionBarRef.current?.contains(t)) return;
      setReactionBarMessageId(null);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [reactionBarMessageId]);

  return {
    reactionBarMessageId,
    setReactionBarMessageId,
    mobileReactionBarRef,
    onMessagePointerDown,
    onMessagePointerEnd,
  };
}
