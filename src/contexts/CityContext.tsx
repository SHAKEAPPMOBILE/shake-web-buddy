import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { findClosestCity, SHAKE_CITIES, City } from "@/data/cities";

interface CityContextType {
  selectedCity: string | null;
  setSelectedCity: (city: string) => void;
  detectedCity: City | null;
  isLoading: boolean;
  isCityOutOfRange: boolean;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [detectedCity, setDetectedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCityOutOfRange, setIsCityOutOfRange] = useState(false);

  useEffect(() => {
    detectLocation();
  }, []);

  const setCity = (city: City) => {
    setDetectedCity(city);
    setIsCityOutOfRange(false);
    setSelectedCity(city.name);
    setIsLoading(false);
  };

  const setCityOutOfRange = (city: City) => {
    setDetectedCity(city);
    setSelectedCity(null);
    setIsCityOutOfRange(true);
    setIsLoading(false);
  };

  const fallbackToDefault = () => {
    // If detection fails, don't auto-pick a hardcoded city.
    // Leave `selectedCity` as null so the user can manually choose.
    setIsCityOutOfRange(false);
    setDetectedCity(null);
    setSelectedCity(null);
    setIsLoading(false);
  };

  const fallbackToIpGeolocation = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Give IP geolocation a bit more time
      
      const response = await fetch("https://ipapi.co/json/", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        fallbackToDefault();
        return;
      }

      const data = await response.json();

      const lat = Number(data?.latitude);
      const lng = Number(data?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const { city: closestCity, distanceKm } = findClosestCity(
          lat,
          lng
        );
        if (distanceKm <= 500) {
          setCity(closestCity);
        } else {
          setCityOutOfRange(closestCity);
        }
      } else {
        fallbackToDefault();
      }
    } catch (error) {
      console.log("IP geolocation error:", error);
      fallbackToDefault();
    }
  };

  const detectLocation = () => {
    setIsLoading(true);

    let didSettle = false;

    if ("geolocation" in navigator) {
      // If geolocation doesn't resolve within 5 seconds, fall back to IP.
      const geoTimeout = setTimeout(() => {
        if (didSettle) return;
        didSettle = true;
        console.log("Geolocation timeout - falling back to IP");
        fallbackToIpGeolocation();
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (didSettle) return;
          didSettle = true;
          clearTimeout(geoTimeout);

          const { latitude, longitude } = position.coords;
          const { city: closestCity, distanceKm } = findClosestCity(latitude, longitude);
          if (distanceKm <= 500) {
            setCity(closestCity);
          } else {
            setCityOutOfRange(closestCity);
          }
        },
        () => {
          if (didSettle) return;
          didSettle = true;
          clearTimeout(geoTimeout);
          // Browser geolocation denied/failed - fallback to IP geolocation
          fallbackToIpGeolocation();
        },
        { timeout: 5000, enableHighAccuracy: false } // Faster, less accurate
      );
    } else {
      // No browser geolocation support - fallback to IP geolocation
      fallbackToIpGeolocation();
    }
  };

  return (
    <CityContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        detectedCity,
        isLoading,
        isCityOutOfRange,
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
