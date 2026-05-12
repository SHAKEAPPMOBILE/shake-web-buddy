import { useState, useRef, useCallback, TouchEvent, ReactNode } from "react";
import { Trash2, LogOut } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onDelete?: () => void;
  canDelete?: boolean;
  /** When true, swiping left reveals a red "Leave" button instead of Delete */
  canLeave?: boolean;
  onLeave?: () => void;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function SwipeableCard({
  children,
  onDelete,
  canDelete = false,
  canLeave = false,
  onLeave,
  className = "",
  style,
  onClick,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingHorizontal = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const REVEAL_THRESHOLD = 70;
  const ACTION_BUTTON_WIDTH = 80;
  const canSwipe = canDelete || canLeave;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!canSwipe) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingHorizontal.current = null;
  }, [canSwipe]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canSwipe || touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Determine swipe direction on first significant move
    if (isSwipingHorizontal.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isSwipingHorizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // Only handle horizontal swipes
    if (!isSwipingHorizontal.current) return;

    // Prevent vertical scroll when swiping horizontally
    e.preventDefault();

    // Only allow left swipe (negative deltaX)
    if (isRevealed) {
      // If already revealed, allow swiping back right
      const newTranslate = Math.min(0, Math.max(-ACTION_BUTTON_WIDTH, -ACTION_BUTTON_WIDTH + deltaX));
      setTranslateX(newTranslate);
    } else {
      // Not revealed yet - only allow left swipe
      const newTranslate = Math.min(0, Math.max(-ACTION_BUTTON_WIDTH - 20, deltaX));
      setTranslateX(newTranslate);
    }
  }, [canSwipe, isRevealed]);

  const handleTouchEnd = useCallback(() => {
    if (!canSwipe) return;

    // Determine final state based on position
    if (Math.abs(translateX) > REVEAL_THRESHOLD) {
      setTranslateX(-ACTION_BUTTON_WIDTH);
      setIsRevealed(true);
    } else {
      setTranslateX(0);
      setIsRevealed(false);
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isSwipingHorizontal.current = null;
  }, [canSwipe, translateX]);

  const handleCardClick = useCallback(() => {
    if (isRevealed) {
      // Close the revealed state
      setTranslateX(0);
      setIsRevealed(false);
    } else if (onClick) {
      onClick();
    }
  }, [isRevealed, onClick]);

  const handleActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canLeave) {
      onLeave?.();
    } else {
      onDelete?.();
    }
  }, [canLeave, onLeave, onDelete]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Action button behind (Delete or Leave) */}
      {canSwipe && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive transition-opacity"
          style={{
            width: ACTION_BUTTON_WIDTH,
            opacity: Math.min(1, Math.abs(translateX) / REVEAL_THRESHOLD),
          }}
        >
          <button
            type="button"
            onClick={handleActionClick}
            className="flex flex-col items-center justify-center gap-1 text-white p-3"
            aria-label={canLeave ? "Leave activity" : "Delete plan"}
          >
            {canLeave ? (
              <>
                <LogOut className="w-6 h-6" />
                <span className="text-xs font-medium">Leave</span>
              </>
            ) : (
              <>
                <Trash2 className="w-6 h-6" />
                <span className="text-xs font-medium">Delete</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main card content */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative ${className}`}
        style={{
          ...style,
          transform: `translateX(${translateX}px)`,
          transition: touchStartX.current !== null ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
