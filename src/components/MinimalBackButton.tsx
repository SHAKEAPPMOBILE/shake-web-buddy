import { ButtonHTMLAttributes, useCallback, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { longPressHaptic } from "@/lib/haptics";

interface MinimalBackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconClassName?: string;
  /** Called when the button is pressed and held. The click that follows the release is swallowed,
   *  so a long press never also triggers `onClick`. Typical use: a short tap steps back inside a
   *  flow, a long press leaves the whole flow. */
  onLongPress?: () => void;
  longPressMs?: number;
}

export function MinimalBackButton({
  className,
  iconClassName,
  type = "button",
  "aria-label": ariaLabel,
  onLongPress,
  longPressMs = 500,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onContextMenu,
  style,
  ...props
}: MinimalBackButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const fired = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  useEffect(() => clear, [clear]);

  return (
    <button
      type={type}
      aria-label={ariaLabel ?? "Back"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/25 bg-transparent text-current transition-colors hover:border-current/45",
        className
      )}
      // Without these, holding on iOS pops the system text-selection / callout instead of reaching us.
      style={onLongPress ? { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", ...style } : style}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (!onLongPress) return;
        fired.current = false;
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          longPressHaptic();
          onLongPress();
        }, longPressMs);
      }}
      onPointerUp={(e) => { onPointerUp?.(e); clear(); }}
      onPointerLeave={(e) => { onPointerLeave?.(e); clear(); }}
      onPointerCancel={(e) => { onPointerCancel?.(e); clear(); }}
      onContextMenu={(e) => { if (onLongPress) e.preventDefault(); onContextMenu?.(e); }}
      onClick={(e) => {
        if (fired.current) { fired.current = false; e.preventDefault(); return; }
        onClick?.(e);
      }}
      {...props}
    >
      <ChevronLeft className={cn("h-5 w-5", iconClassName)} />
    </button>
  );
}
