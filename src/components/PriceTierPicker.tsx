import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PriceTier {
  label: string;
  amount: number;
}

interface PriceTierPickerProps {
  tiers: PriceTier[];
  selected: string | null;
  onSelect: (label: string) => void;
  className?: string;
}

export function PriceTierPicker({ tiers, selected, onSelect, className }: PriceTierPickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {tiers.map((tier) => {
        const isSelected = selected === tier.label;
        return (
          <button
            key={tier.label}
            type="button"
            onClick={() => onSelect(tier.label)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors",
              isSelected
                ? "border-blue-500 bg-blue-500/10"
                : "border-border bg-muted/40 hover:bg-muted/60"
            )}
          >
            <span className="font-medium">{tier.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-green-600 font-medium">${tier.amount}</span>
              {isSelected && <Check className="w-4 h-4 text-blue-500" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
