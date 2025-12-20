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
import { SHAKE_CITIES, REGIONS, City } from "@/data/cities";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface CitySelectorProps {
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export function CitySelector({ isPremium = false, onUpgradeClick }: CitySelectorProps) {
  const [selectedCity, setSelectedCity] = useState<string>("Detecting...");
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    setIsLoading(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Use reverse geocoding to get city name
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const cityName = data.city || data.locality || "Unknown Location";
            
            // Check if detected city is in our list
            const matchedCity = SHAKE_CITIES.find(
              city => city.name.toLowerCase() === cityName.toLowerCase()
            );
            
            if (matchedCity) {
              setDetectedCity(matchedCity.name);
              setSelectedCity(matchedCity.name);
            } else {
              // Find closest city or use detected name
              setDetectedCity(cityName);
              setSelectedCity(cityName);
            }
          } catch (error) {
            setDetectedCity("Los Angeles");
            setSelectedCity("Los Angeles");
          }
          setIsLoading(false);
        },
        (error) => {
          console.log("Geolocation error:", error);
          setDetectedCity("Los Angeles");
          setSelectedCity("Los Angeles");
          setIsLoading(false);
        },
        { timeout: 5000 }
      );
    } else {
      setDetectedCity("Los Angeles");
      setSelectedCity("Los Angeles");
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
          <MapPin className="w-4 h-4 text-primary" />
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
                Your Location
              </DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={() => setSelectedCity(detectedCity)}
                className="cursor-pointer"
              >
                <MapPin className="w-4 h-4 mr-2 text-primary" />
                {detectedCity}
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
