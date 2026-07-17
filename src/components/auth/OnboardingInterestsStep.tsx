import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTEREST_CATEGORIES } from "@/lib/interests";

interface OnboardingInterestsStepProps {
  selected: string[];
  onToggle: (interest: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

/**
 * Chat-flow-style interests picker for the signup wizard — mirrors the
 * "What's the plan?" bot-question + bottom composer pattern from
 * ProposePlanPage. The mother category chips live in the message area;
 * tapping one reveals its sub-options as pills in the composer bar, the
 * same way date pills (Today/Tomorrow/…) work on the plan-creation flow.
 */
export function OnboardingInterestsStep({
  selected,
  onToggle,
  onContinue,
  onSkip,
}: OnboardingInterestsStepProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const currentCategory = activeCategory
    ? INTEREST_CATEGORIES.find((c) => c.name === activeCategory) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Bot bubble */}
      <div className="flex flex-row items-end gap-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
          style={{ background: "#e9d5ff" }}
        >
          ✨
        </div>
        <div className="bg-muted rounded-2xl rounded-tl-none px-5 py-4 flex-1">
          <p className="text-xl font-semibold text-foreground leading-snug">
            {t("auth.interestsQuestion")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{t("auth.interestsSubtext")}</p>
        </div>
      </div>

      {/* Mother category chips */}
      <div className="flex flex-wrap gap-2">
        {INTEREST_CATEGORIES.map((category) => {
          const isActive = category.name === activeCategory;
          const countInCategory = category.interests.filter((i) => selected.includes(i)).length;
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : category.name)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                isActive
                  ? "bg-black text-white border-black"
                  : "bg-background text-foreground border-border hover:border-black/40"
              )}
            >
              {category.name}
              {countInCategory > 0 && (
                <span
                  className={cn(
                    "ml-1.5 text-xs rounded-full px-1.5 leading-none",
                    isActive ? "bg-white/25 text-white" : "bg-black/10 text-foreground"
                  )}
                >
                  {countInCategory}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Composer — sub-options for the active category, same visual language
          as the date-pill row on the plan-creation flow */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex gap-2 items-center overflow-x-auto h-16 rounded-2xl border border-border bg-muted/60 px-4 scrollbar-hide">
          {currentCategory ? (
            currentCategory.interests.map((interest) => {
              const isSelected = selected.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => onToggle(interest)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-all",
                    isSelected
                      ? "bg-black text-white"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {interest}
                </button>
              );
            })
          ) : (
            <span className="text-sm text-muted-foreground">{t("auth.interestsPlaceholder")}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
          aria-label="Continue"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 text-center"
      >
        {t("auth.skipForNow")}
      </button>
    </div>
  );
}
