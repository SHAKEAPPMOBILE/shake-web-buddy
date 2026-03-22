import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SHAKE_CITIES, REGIONS, City } from "@/data/cities";
import { useCity } from "@/contexts/CityContext";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./LoadingSpinner";

interface CitySelectorProps {
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  /**
   * Optional controlled open state for the dropdown.
   * Useful when rendering CitySelector inside another modal.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * `picker` = searchable list only (e.g. bottom sheet) — no trigger; uses global city state.
   * `dropdown` = default header control.
   */
  variant?: "dropdown" | "picker";
  /** Called after a city is chosen or when reverting to detected location (picker mode). */
  onPickerClose?: () => void;
  /** Focus search when the picker opens (sheet/modal). */
  autoFocusSearch?: boolean;
}

function buildGrouped(): Record<string, City[]> {
  return REGIONS.reduce((acc, region) => {
    acc[region] = SHAKE_CITIES.filter((city) => city.region === region);
    return acc;
  }, {} as Record<string, City[]>);
}

type CityPickerBodyProps = {
  onClose?: () => void;
  className?: string;
  autoFocusSearch?: boolean;
  /** Header dropdown: cap height; sheet/modal: fill available space */
  embedded?: boolean;
};

/** Shared searchable city list — same behavior in header dropdown and home/plans pickers */
export function CityPickerBody({ onClose, className, autoFocusSearch, embedded }: CityPickerBodyProps) {
  const { selectedCity, setSelectedCity, detectedCity, revertToDetectedLocation } = useCity();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusSearch) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [autoFocusSearch]);

  const groupedCities = useMemo(() => buildGrouped(), []);

  const filteredGrouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedCities;
    const out: Record<string, City[]> = {};
    for (const [region, cities] of Object.entries(groupedCities)) {
      const filtered = cities.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          region.toLowerCase().includes(q),
      );
      if (filtered.length) out[region] = filtered;
    }
    return out;
  }, [groupedCities, searchQuery]);

  const handleSelect = (cityName: string) => {
    setSelectedCity(cityName);
    onClose?.();
  };

  const handleBackToLocation = () => {
    revertToDetectedLocation();
    onClose?.();
  };

  const showBackToLocation =
    !!detectedCity &&
    !!selectedCity &&
    selectedCity.toLowerCase() !== detectedCity.name.toLowerCase();

  const rowClass =
    "w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80 active:bg-muted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3",
        embedded ? "max-h-[min(68vh,440px)] w-full" : "min-h-0 flex-1",
        className,
      )}
    >
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Search cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 border-border/80 bg-muted/40 pl-10 pr-3 shadow-sm focus-visible:bg-background"
          autoComplete="off"
        />
      </div>

      {showBackToLocation && (
        <button
          type="button"
          onClick={handleBackToLocation}
          className="shrink-0 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          ✕ Back to my location
          {detectedCity ? (
            <span className="ml-1 text-xs text-muted-foreground/80">({detectedCity.name})</span>
          ) : null}
        </button>
      )}

      <div
        className={cn(
          "min-h-0 overscroll-contain pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5",
          embedded ? "max-h-[min(50vh,320px)] overflow-y-auto" : "flex-1 overflow-y-auto",
        )}
      >
        <div className="space-y-1 pb-1">
          {detectedCity && (
            <>
              <div className="px-1 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your Location
              </div>
              <button
                type="button"
                onClick={() => handleSelect(detectedCity.name)}
                className={cn(rowClass, "flex cursor-pointer items-center gap-2")}
              >
                <span className="font-medium text-foreground">
                  {detectedCity.name}, {detectedCity.country}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">Nearby</span>
              </button>
              <div className="my-2 h-px bg-border/80" />
            </>
          )}

          {Object.entries(filteredGrouped).map(([region, cities]) => (
            <div key={region} className="pt-1">
              <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{region}</div>
              {cities.map((city) => (
                <button
                  key={`${city.name}-${city.country}`}
                  type="button"
                  onClick={() => handleSelect(city.name)}
                  className={cn(rowClass, "cursor-pointer text-foreground")}
                >
                  {city.name}, {city.country}
                </button>
              ))}
            </div>
          ))}

          {searchQuery.trim() && Object.keys(filteredGrouped).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No cities match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CitySelector({
  open,
  onOpenChange,
  variant = "dropdown",
  onPickerClose,
  autoFocusSearch,
}: CitySelectorProps) {
  const { selectedCity, isLoading } = useCity();

  if (variant === "picker") {
    return (
      <CityPickerBody
        onClose={onPickerClose}
        autoFocusSearch={autoFocusSearch}
        className="h-full min-h-0 w-full"
        embedded={false}
      />
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <span className="inline-flex items-center justify-center w-4 h-4 text-shake-teal">📍</span>
        )}
        <span>{selectedCity ?? "Select city"}</span>
        <ChevronDown className="w-3 h-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 flex max-h-[min(70vh,480px)] w-80 flex-col overflow-hidden border border-border bg-card p-3"
        align="end"
      >
        <CityPickerBody
          embedded
          onClose={() => onOpenChange?.(false)}
          className="min-w-0"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
