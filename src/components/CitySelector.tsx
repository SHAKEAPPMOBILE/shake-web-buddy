import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SHAKE_CITIES, REGIONS, City } from "@/data/cities";
import { useCity } from "@/contexts/CityContext";
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
};

/** Shared searchable city list — same behavior in header dropdown and home/plans pickers */
export function CityPickerBody({ onClose, className }: CityPickerBodyProps) {
  const { selectedCity, setSelectedCity, detectedCity, revertToDetectedLocation } = useCity();
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
          autoComplete="off"
        />
      </div>

      {showBackToLocation && (
        <button
          type="button"
          onClick={handleBackToLocation}
          className="w-full text-left text-sm text-muted-foreground hover:text-foreground py-2 px-1 rounded-md hover:bg-muted/60 transition-colors"
        >
          ✕ Back to my location
          {detectedCity ? (
            <span className="text-xs text-muted-foreground/80 ml-1">
              ({detectedCity.name})
            </span>
          ) : null}
        </button>
      )}

      <div className="overflow-y-auto max-h-[min(55vh,360px)] w-full pr-1 -mr-1 space-y-1">
        {detectedCity && (
          <>
            <div className="text-xs text-muted-foreground px-1 pt-1">Your Location (Closest City)</div>
            <button
              type="button"
              onClick={() => handleSelect(detectedCity.name)}
              className="w-full text-left px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer flex items-center gap-2 text-sm"
            >
              <span>
                {detectedCity.name}, {detectedCity.country}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">Nearby</span>
            </button>
            <div className="h-px bg-border my-2" />
          </>
        )}

        {Object.entries(filteredGrouped).map(([region, cities]) => (
          <div key={region} className="pt-1">
            <div className="text-xs text-muted-foreground px-2 py-1">{region}</div>
            {cities.map((city) => (
              <button
                key={`${city.name}-${city.country}`}
                type="button"
                onClick={() => handleSelect(city.name)}
                className="w-full text-left px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer flex items-center gap-2 text-sm"
              >
                <span>
                  {city.name}, {city.country}
                </span>
              </button>
            ))}
          </div>
        ))}

        {searchQuery.trim() && Object.keys(filteredGrouped).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No cities match your search.</p>
        )}
      </div>
    </div>
  );
}

export function CitySelector({
  open,
  onOpenChange,
  variant = "dropdown",
  onPickerClose,
}: CitySelectorProps) {
  const { selectedCity, isLoading } = useCity();

  if (variant === "picker") {
    return <CityPickerBody onClose={onPickerClose} className="flex flex-col gap-3 w-full" />;
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
      <DropdownMenuContent className="w-80 max-h-[min(70vh,480px)] flex flex-col bg-card border border-border z-50 p-3" align="end">
        <CityPickerBody
          onClose={() => onOpenChange?.(false)}
          className="flex flex-col gap-3 w-full min-w-0"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
