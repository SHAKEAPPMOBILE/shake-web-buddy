import { useState, useEffect } from "react";
import { MapPin, Crown, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHAKE_CITIES, REGIONS, City, findClosestCity } from "@/data/cities";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CitySelectorProps {
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export function CitySelector({ onUpgradeClick }: CitySelectorProps) {
  const { isPremium } = useAuth();
  const [selectedCity, setSelectedCity] = useState<string>("Detecting...");
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCity, setDetectedCity] = useState<City | null>(null);

  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    setIsLoading(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Find the closest city from our list
          const closestCity = findClosestCity(latitude, longitude);
          
          setDetectedCity(closestCity);
          setSelectedCity(closestCity.name);
          setIsLoading(false);
        },
        (error) => {
          console.log("Geolocation error:", error);
          // Default to first city in list
          const defaultCity = SHAKE_CITIES[0];
          setDetectedCity(defaultCity);
          setSelectedCity(defaultCity.name);
          setIsLoading(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      const defaultCity = SHAKE_CITIES[0];
      setDetectedCity(defaultCity);
      setSelectedCity(defaultCity.name);
      setIsLoading(false);
    }
  };

  const handleCitySelect = (cityName: string) => {
    if (!isPremium) {
      toast.error("Premium feature", {
        description: "Upgrade to Premium to select any city worldwide!",
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
        {!isPremium && <Crown className="w-3 h-3 text-shake-yellow" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-64 bg-card border border-border z-50"
        align="end"
      >
        {!isPremium && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-shake-yellow">
              <Crown className="w-4 h-4" />
              Upgrade for $5/month to select any city
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
                    <Crown className="w-3 h-3 ml-auto text-shake-yellow" />
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
