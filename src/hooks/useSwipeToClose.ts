import { useRef, useCallback, TouchEvent } from "react";

interface UseSwipeToCloseOptions {
  onClose: () => void;
  threshold?: number; // Minimum swipe distance to trigger close
  enabled?: boolean;
}

export function useSwipeToClose({
  onClose,
  threshold = 100,
  enabled = true,
}: UseSwipeToCloseOptions) {
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || touchStartY.current === null || touchStartX.current === null) return;

      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchEndY - touchStartY.current;
      const deltaX = Math.abs(touchEndX - touchStartX.current);

      // Only trigger if swipe is more vertical than horizontal
      // and the swipe distance exceeds threshold
      if (deltaY > threshold && deltaY > deltaX) {
        onClose();
      }

      touchStartY.current = null;
      touchStartX.current = null;
    },
    [enabled, threshold, onClose]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
