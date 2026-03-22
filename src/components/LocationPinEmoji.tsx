import { cn } from "@/lib/utils";

/**
 * Red map pin emoji (📍) — same visual as the former Plans empty-state location icon.
 * Use for inline hero/city rows; empty states that need 🚧 use that emoji directly.
 */
export function LocationPinEmoji({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 text-muted-foreground select-none leading-none",
        className,
      )}
      role="img"
      aria-label="Location"
    >
      📍
    </span>
  );
}
