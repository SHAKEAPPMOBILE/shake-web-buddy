import { useState, useEffect } from "react";
import { INTEREST_CATEGORIES } from "@/lib/interests";
import { cn } from "@/lib/utils";

interface InterestsAccordionProps {
  selected: string[];
  onToggle: (interest: string) => void;
  shaking: boolean;
  onShakingEnd: () => void;
}

export function InterestsAccordion({
  selected,
  onToggle,
  shaking,
  onShakingEnd,
}: InterestsAccordionProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(INTEREST_CATEGORIES[0].name);

  // Auto-close after 10 seconds; resets whenever a different category is opened
  useEffect(() => {
    if (!activeCategory) return;
    const timer = setTimeout(() => setActiveCategory(null), 10000);
    return () => clearTimeout(timer);
  }, [activeCategory]);

  const currentCategory = activeCategory
    ? INTEREST_CATEGORIES.find((c) => c.name === activeCategory) ?? null
    : null;

  return (
    <div
      className={cn("space-y-3", shaking && "animate-shake-x")}
      onAnimationEnd={onShakingEnd}
    >
      {/* Category pills — relative + z-30 so they always sit above the
          tap-outside overlay below (which is position:fixed with z-10 and
          would otherwise paint on top of these non-positioned buttons,
          intercepting the first click when switching categories and
          requiring a second click to actually open the new one). */}
      <div className="relative z-30 flex flex-wrap gap-2">
        {INTEREST_CATEGORIES.map((category) => {
          const isActive = category.name === activeCategory;
          const countInCategory = category.interests.filter((i) => selected.includes(i)).length;
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : category.name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                isActive
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-background text-foreground border-border hover:border-blue-400"
              )}
            >
              {category.name}
              {countInCategory > 0 && (
                <span className={cn(
                  "ml-1.5 text-xs rounded-full px-1 leading-none",
                  isActive ? "bg-white/30 text-white" : "bg-blue-500/15 text-blue-500"
                )}>
                  {countInCategory}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Interests for the active category */}
      {currentCategory && (
        <div className="relative">
          {/* Tap-outside overlay — behind the interest pills */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setActiveCategory(null)}
          />
          <div className="relative z-20 flex flex-wrap gap-2">
            {currentCategory.interests.map((interest) => {
              const isSelected = selected.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => onToggle(interest)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    isSelected
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-background text-foreground border-border hover:border-blue-400"
                  )}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
