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
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    // Start with a default city immediately to avoid showing "Detecting..."
    return SHAKE_CITIES[0]?.name || "Loading...";
  });
  const [detectedCity, setDetectedCity] = useState<City | null>(SHAKE_CITIES[0] || null);
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
    const defaultCity = SHAKE_CITIES[0];
    if (defaultCity) {
      setCity(defaultCity);
    } else {
      setIsCityOutOfRange(false);
      setSelectedCity(null);
      setIsLoading(false);
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
    
    if ("geolocation" in navigator) {
      // Set a faster timeout for geolocation
      const geoTimeout = setTimeout(() => {
        console.log("Geolocation timeout - falling back to IP");
        fallbackToIpGeolocation();
      }, 5000); // 5 second timeout instead of 10

      navigator.geolocation.getCurrentPosition(
        (position) => {
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
