import { MapPin, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHAKE_CITIES, REGIONS, City } from "@/data/cities";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { SuperHumanIcon } from "./SuperHumanIcon";

interface CitySelectorProps {
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export function CitySelector({ onUpgradeClick }: CitySelectorProps) {
  const { isPremium } = useAuth();
  const { selectedCity, setSelectedCity, detectedCity, isLoading } = useCity();

  const handleCitySelect = (cityName: string) => {
    if (!isPremium) {
      toast.error("Super-Human feature", {
        description: "Become a Super-Human to select any city worldwide!",
        action: {
          label: "Upgrade",
          onClick: () => onUpgradeClick?.(),
        },
      });
      return;
    }
    setSelectedCity(cityName);
  };

  const groupedCities = REGIONS.reduce((acc, region) => {
    acc[region] = SHAKE_CITIES.filter(city => city.region === region);
    return acc;
  }, {} as Record<string, City[]>);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <MapPin className="w-4 h-4 text-shake-teal" />
        )}
        <span>{selectedCity}</span>
        <ChevronDown className="w-3 h-3" />
        {!isPremium && <SuperHumanIcon size={14} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-64 bg-card border border-border z-50"
        align="end"
      >
        {!isPremium && (
          <>
            <DropdownMenuLabel 
              className="flex items-center gap-2 text-shake-yellow cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onUpgradeClick?.()}
            >
              <SuperHumanIcon size={16} />
              Become a Super-Human to select any city
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        
        <ScrollArea className="h-[300px]">
          {detectedCity && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Your Location (Closest City)
              </DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={() => setSelectedCity(detectedCity.name)}
                className="cursor-pointer"
              >
                <MapPin className="w-4 h-4 mr-2 text-shake-teal" />
                {detectedCity.name}, {detectedCity.country}
                <span className="ml-auto text-xs text-muted-foreground">Free</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {Object.entries(groupedCities).map(([region, cities]) => (
            <div key={region}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {region}
              </DropdownMenuLabel>
              {cities.map((city) => (
                <DropdownMenuItem
                  key={`${city.name}-${city.country}`}
                  onClick={() => handleCitySelect(city.name)}
                  className="cursor-pointer"
                >
                  {city.name}, {city.country}
                  {!isPremium && (
                    <SuperHumanIcon size={14} className="ml-auto" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
