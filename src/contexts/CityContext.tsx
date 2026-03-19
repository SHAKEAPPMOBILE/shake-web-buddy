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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const tryIpApi = async (): Promise<{ lat: number; lng: number } | null> => {
      console.log("[CityContext] IP fallback: ipapi.co start");
      try {
        const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
        if (!response.ok) {
          console.warn("[CityContext] IP fallback: ipapi.co non-OK", response.status);
          return null;
        }

        const data = await response.json();
        const lat = Number(data?.latitude);
        const lng = Number(data?.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          console.log("[CityContext] IP fallback: ipapi.co success", { lat, lng, city: data?.city });
          return { lat, lng };
        }

        console.warn("[CityContext] IP fallback: ipapi.co missing coords", {
          lat: data?.latitude,
          lng: data?.longitude,
          city: data?.city,
        });
        return null;
      } catch (err) {
        console.warn("[CityContext] IP fallback: ipapi.co failed", err);
        return null;
      }
    };

    const tryIpWho = async (): Promise<{ lat: number; lng: number } | null> => {
      console.log("[CityContext] IP fallback: ipwho.is start");
      try {
        const response = await fetch("https://ipwho.is/", { signal: controller.signal });
        if (!response.ok) {
          console.warn("[CityContext] IP fallback: ipwho.is non-OK", response.status);
          return null;
        }

        const data = await response.json();
        const lat = Number(data?.latitude);
        const lng = Number(data?.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          console.log("[CityContext] IP fallback: ipwho.is success", { lat, lng, city: data?.city });
          return { lat, lng };
        }

        console.warn("[CityContext] IP fallback: ipwho.is missing coords", {
          lat: data?.latitude,
          lng: data?.longitude,
          city: data?.city,
        });
        return null;
      } catch (err) {
        console.warn("[CityContext] IP fallback: ipwho.is failed", err);
        return null;
      }
    };

    try {
      const coords = (await tryIpApi()) ?? (await tryIpWho());
      clearTimeout(timeoutId);

      if (!coords) {
        console.warn("[CityContext] IP fallback: both services failed, leaving selectedCity=null");
        fallbackToDefault();
        return;
      }

      const { city: closestCity, distanceKm } = findClosestCity(coords.lat, coords.lng);
      console.log("[CityContext] IP fallback: resolved closest city", {
        closestCity: closestCity.name,
        distanceKm,
      });

      if (distanceKm <= 500) setCity(closestCity);
      else setCityOutOfRange(closestCity);
    } catch (error) {
      console.warn("[CityContext] IP geolocation error (outer):", error);
      fallbackToDefault();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const detectLocation = () => {
    setIsLoading(true);
    console.log("[CityContext] detectLocation start");

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
          console.log("[CityContext] Geolocation success", { latitude, longitude });
          const { city: closestCity, distanceKm } = findClosestCity(latitude, longitude);
          console.log("[CityContext] Geolocation closest city", { closestCity: closestCity.name, distanceKm });
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
          console.warn("[CityContext] Geolocation denied/failed - falling back to IP");
          fallbackToIpGeolocation();
        },
        { timeout: 5000, enableHighAccuracy: false } // Faster, less accurate
      );
    } else {
      // No browser geolocation support - fallback to IP geolocation
      console.warn("[CityContext] Geolocation not supported - falling back to IP");
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
