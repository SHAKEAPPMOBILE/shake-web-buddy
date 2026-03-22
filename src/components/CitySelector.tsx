import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

export function CitySelector({ onUpgradeClick, open, onOpenChange }: CitySelectorProps) {
  const { selectedCity, setSelectedCity, detectedCity, isLoading } = useCity();

  const closeDropdown = () => onOpenChange?.(false);

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    closeDropdown();
  };

  const groupedCities = REGIONS.reduce((acc, region) => {
    acc[region] = SHAKE_CITIES.filter(city => city.region === region);
    return acc;
  }, {} as Record<string, City[]>);

  // When `open` is controlled by a parent modal/dialog, rendering a Radix DropdownMenu
  // inside the Dialog can sometimes leave behind a portal element that blocks clicks.
  // In that controlled mode, render a plain list and close the parent via `onOpenChange(false)`.
  if (typeof open === "boolean") {
    return (
      <div className="w-64 flex flex-col">
        <div className="flex items-center gap-2 text-sm text-muted-foreground outline-none">
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <span className="inline-flex items-center justify-center w-4 h-4 text-shake-teal">📍</span>
          )}
          <span>{selectedCity ?? "Select city"}</span>
          <ChevronDown className="w-3 h-3" />
        </div>

        {detectedCity && (
          <>
            <div className="text-xs text-muted-foreground px-2 py-1">
              Your Location (Closest City)
            </div>
            <button
              type="button"
              onClick={() => handleCitySelect(detectedCity.name)}
              className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-pointer flex items-center gap-2"
            >
              <span>{detectedCity.name}, {detectedCity.country}</span>
              <span className="ml-auto text-xs text-muted-foreground">Free</span>
            </button>
            <div className="h-px bg-border my-2" />
          </>
        )}

        <div className="overflow-y-auto max-h-[300px] w-full pr-2">
          {Object.entries(groupedCities).map(([region, cities]) => (
            <div key={region} className="pt-1">
              <div className="text-xs text-muted-foreground px-2 py-1">{region}</div>
              {cities.map((city) => (
                <button
                  key={`${city.name}-${city.country}`}
                  type="button"
                  onClick={() => handleCitySelect(city.name)}
                  className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-pointer flex items-center gap-2"
                >
                  <span>{city.name}, {city.country}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
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
      <DropdownMenuContent className="w-64 bg-card border border-border z-50" align="end">
        {detectedCity && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your Location (Closest City)
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleCitySelect(detectedCity.name)}
              className="cursor-pointer"
            >
              {detectedCity.name}, {detectedCity.country}
              <span className="ml-auto text-xs text-muted-foreground">Free</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <div className="overflow-y-auto max-h-[300px] w-full pr-2">
          {Object.entries(groupedCities).map(([region, cities]) => (
            <div key={region}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">{region}</DropdownMenuLabel>
              {cities.map((city) => (
                <DropdownMenuItem
                  key={`${city.name}-${city.country}`}
                  onClick={() => handleCitySelect(city.name)}
                  className="cursor-pointer"
                >
                  {city.name}, {city.country}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
