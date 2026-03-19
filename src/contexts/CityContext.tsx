import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { findClosestCity, SHAKE_CITIES, City } from "@/data/cities";

interface CityContextType {
  selectedCity: string | null;
  setSelectedCity: (city: string) => void;
  detectedCity: City | null;
  isLoading: boolean;
  isCityOutOfRange: boolean;
  isDetectingLocation: boolean;
  refreshLocation: () => Promise<{ ok: boolean; error?: string }>;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(() => {
    // Start with a default city immediately to avoid showing "Detecting..."
    return SHAKE_CITIES[0]?.name || "Loading...";
  });
  const [detectedCity, setDetectedCity] = useState<City | null>(SHAKE_CITIES[0] || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCityOutOfRange, setIsCityOutOfRange] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  useEffect(() => {
    void detectLocation({ initial: true });
  }, []);

  const applyCity = (city: City) => {
    setDetectedCity(city);
    setIsCityOutOfRange(false);
    setSelectedCity(city.name);
  };

  const applyCityOutOfRange = (city: City) => {
    setDetectedCity(city);
    setSelectedCity(null);
    setIsCityOutOfRange(true);
  };

  const fallbackToDefault = () => {
    const defaultCity = SHAKE_CITIES[0];
    if (defaultCity) {
      applyCity(defaultCity);
    } else {
      setIsCityOutOfRange(false);
      setSelectedCity(null);
    }
  };

  const fallbackToIpGeolocation = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch("https://ipapi.co/json/", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const { city: closestCity, distanceKm } = findClosestCity(
          data.latitude,
          data.longitude
        );
        if (distanceKm <= 500) {
          applyCity(closestCity);
        } else {
          applyCityOutOfRange(closestCity);
        }
      } else {
        fallbackToDefault();
      }
    } catch (error) {
      console.log("IP geolocation error:", error);
      fallbackToDefault();
    }
  };

  const detectLocation = async ({ initial }: { initial: boolean }) => {
    if (initial) setIsLoading(true);
    else setIsDetectingLocation(true);
    
    const cleanup = () => {
      if (initial) setIsLoading(false);
      else setIsDetectingLocation(false);
    };

    try {
      if ("geolocation" in navigator) {
        // Browser geolocation with explicit timeout via Promise.
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { timeout: 5000, enableHighAccuracy: false }
          );
        });

        const { latitude, longitude } = position.coords;
        const { city: closestCity, distanceKm } = findClosestCity(latitude, longitude);
        if (distanceKm <= 500) applyCity(closestCity);
        else applyCityOutOfRange(closestCity);

        return { ok: true as const };
      }

      // No browser geolocation support - fallback to IP geolocation
      await fallbackToIpGeolocation();
      return { ok: true as const };
    } catch (err) {
      // Browser geolocation denied/failed - fallback to IP geolocation
      await fallbackToIpGeolocation();
      const message =
        err instanceof Error ? err.message : (typeof err === "string" ? err : "Failed to detect location");
      return { ok: false as const, error: message };
    } finally {
      cleanup();
    }
  };

  const refreshLocation = async () => {
    return detectLocation({ initial: false });
  };

  return (
    <CityContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        detectedCity,
        isLoading,
        isCityOutOfRange,
        isDetectingLocation,
        refreshLocation,
      }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const context = useContext(CityContext);
  if (context === undefined) {
    throw new Error("useCity must be used within a CityProvider");
  }
  return context;
}
