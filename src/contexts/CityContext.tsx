import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { findClosestCity, SHAKE_CITIES, City } from "@/data/cities";

interface CityContextType {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  detectedCity: City | null;
  isLoading: boolean;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<string>("Detecting...");
  const [detectedCity, setDetectedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    detectLocation();
  }, []);

  const fallbackToIpGeolocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const closestCity = findClosestCity(data.latitude, data.longitude);
        setDetectedCity(closestCity);
        setSelectedCity(closestCity.name);
      } else {
        // Final fallback to first city
        const defaultCity = SHAKE_CITIES[0];
        setDetectedCity(defaultCity);
        setSelectedCity(defaultCity.name);
      }
    } catch (error) {
      console.log("IP geolocation error:", error);
      const defaultCity = SHAKE_CITIES[0];
      setDetectedCity(defaultCity);
      setSelectedCity(defaultCity.name);
    }
    setIsLoading(false);
  };

  const detectLocation = () => {
    setIsLoading(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const closestCity = findClosestCity(latitude, longitude);
          
          setDetectedCity(closestCity);
          setSelectedCity(closestCity.name);
          setIsLoading(false);
        },
        () => {
          // Browser geolocation denied/failed - fallback to IP geolocation
          fallbackToIpGeolocation();
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      // No browser geolocation support - fallback to IP geolocation
      fallbackToIpGeolocation();
    }
  };

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity, detectedCity, isLoading }}>
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
