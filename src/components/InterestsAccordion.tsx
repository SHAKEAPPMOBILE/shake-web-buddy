import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { INTEREST_CATEGORIES, MAX_INTERESTS } from "@/lib/interests";
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
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div
      className={cn("space-y-1", shaking && "animate-shake-x")}
      onAnimationEnd={onShakingEnd}
    >
      {INTEREST_CATEGORIES.map((category) => {
        const isOpen = openCategory === category.name;
        const selectedInCategory = category.interests.filter((i) => selected.includes(i));

        return (
          <div key={category.name} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenCategory(isOpen ? null : category.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-background hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{category.name}</span>
                {selectedInCategory.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                    {selectedInCategory.length}
                  </span>
                )}
              </div>
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              }
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-2 flex flex-wrap gap-2 border-t border-border bg-muted/20">
                {category.interests.map((interest) => {
                  const isSelected = selected.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => onToggle(interest)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : selected.length >= MAX_INTERESTS
                          ? "bg-background text-muted-foreground border-border cursor-not-allowed opacity-50"
                          : "bg-background text-foreground border-border hover:border-primary/60"
                      )}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
