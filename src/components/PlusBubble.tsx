import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// A frosted-glass bubble: the page behind it shows through, blurred, with a bright rim and a soft shadow.
const bubbleStyle: React.CSSProperties = {
  background: "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.62) 42%, rgba(240,242,247,0.5) 100%)",
  backdropFilter: "blur(14px) saturate(1.5)",
  WebkitBackdropFilter: "blur(14px) saturate(1.5)",
  border: "1px solid rgba(255,255,255,0.85)",
  boxShadow:
    "0 14px 30px -8px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.10), inset 0 2px 3px rgba(255,255,255,0.95), inset 0 -8px 14px rgba(0,0,0,0.05)",
};

/** The + in the middle of the tab bar. One component, so the app and the store mockups can't drift apart. */
export function PlusBubble({ active = false }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "relative w-[76px] h-[76px] rounded-full flex items-center justify-center transition-transform active:scale-95",
        active && "scale-110"
      )}
      style={bubbleStyle}
    >
      <Plus className="relative w-10 h-10 text-gray-900" strokeWidth={2.2} />
      <span className="glass-glint" aria-hidden="true" />
    </div>
  );
}
