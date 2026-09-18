import { cn } from "@/lib/utils";

interface EmojiShineProps {
  emoji: string;
  className?: string;
  /** Only the sunglasses emoji gets a lens band right now — pass true to
   *  add the periodic light-glint sweep across the middle of the glyph. */
  enabled?: boolean;
}

/** An emoji fallback (no photo for this activity, e.g. "Propose a plan")
 *  with an optional light-glint sweep across it — a reflection catching
 *  the sunglasses' lenses, same "feels alive" idea as the food icons. */
export function EmojiShine({ emoji, className, enabled }: EmojiShineProps) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {emoji}
      {enabled && <span className="living-icon-lens-shine" aria-hidden="true" />}
    </span>
  );
}
