import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { findClosestCity, SHAKE_CITIES, City } from "@/data/cities";

const SHAKE_SELECTED_CITY_LS = "shake_selected_city";

function isValidCityName(name: string | null | undefined): boolean {
  if (!name) return false;
  return SHAKE_CITIES.some((c) => c.name === name);
}

function readPersistedCity(): string | null {
  try {
    const v = localStorage.getItem(SHAKE_SELECTED_CITY_LS);
    return isValidCityName(v) ? v : null;
  } catch {
    return null;
  }
}

interface CityContextType {
  selectedCity: string | null;
  setSelectedCity: (city: string) => void;
  /** Snap selection back to IP/GPS-detected nearest supported city */
  revertToDetectedLocation: () => void;
  detectedCity: City | null;
  isLoading: boolean;
  isCityOutOfRange: boolean;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<string | null>(() =>
    readPersistedCity(),
  );
  const [detectedCity, setDetectedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCityOutOfRange, setIsCityOutOfRange] = useState(false);

  const setSelectedCity = useCallback((city: string) => {
    if (!isValidCityName(city)) return;
    try {
      localStorage.setItem(SHAKE_SELECTED_CITY_LS, city);
    } catch {
      /* ignore quota */
    }
    setSelectedCityState(city);
    setIsCityOutOfRange(false);
  }, []);

  const revertToDetectedLocation = useCallback(() => {
    if (!detectedCity) return;
    try {
      localStorage.setItem(SHAKE_SELECTED_CITY_LS, detectedCity.name);
    } catch {
      /* ignore */
    }
    setSelectedCityState(detectedCity.name);
    setIsCityOutOfRange(false);
  }, [detectedCity]);

  useEffect(() => {
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCity = (city: City) => {
    setDetectedCity(city);
    setIsCityOutOfRange(false);
    if (!readPersistedCity()) {
      setSelectedCityState(city.name);
      try {
        localStorage.setItem(SHAKE_SELECTED_CITY_LS, city.name);
      } catch {
        /* ignore */
      }
    }
    setIsLoading(false);
  };

  const setCityOutOfRange = (city: City) => {
    setDetectedCity(city);
    setIsCityOutOfRange(true);
    if (!readPersistedCity()) {
      setSelectedCityState(null);
    }
    setIsLoading(false);
  };

  const fallbackToDefault = () => {
    setIsCityOutOfRange(false);
    setDetectedCity(null);
    if (!readPersistedCity()) {
      setSelectedCityState(null);
    }
    setIsLoading(false);
  };

  const fallbackToIpGeolocation = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const normalize = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    const tryIpInfo = async (): Promise<{ lat: number; lng: number; city?: string } | null> => {
      console.log("[CityContext] IP fallback: ipinfo.io/json start");
      try {
        const response = await fetch("https://ipinfo.io/json", { signal: controller.signal });
        if (!response.ok) {
          console.warn("[CityContext] IP fallback: ipinfo non-OK", response.status);
          return null;
        }
        const data = await response.json();
        const loc = typeof data?.loc === "string" ? data.loc : null;
        const [latStr, lngStr] = loc ? loc.split(",").map((v: string) => v.trim()) : [null, null];
        const lat = latStr ? Number(latStr) : NaN;
        const lng = lngStr ? Number(lngStr) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          console.log("[CityContext] IP fallback: ipinfo success", {
            lat,
            lng,
            city: data?.city,
          });
          return { lat, lng, city: data?.city };
        }

        console.warn("[CityContext] IP fallback: ipinfo missing coords", {
          loc: data?.loc,
          city: data?.city,
        });
        return null;
      } catch (err) {
        console.warn("[CityContext] IP fallback: ipinfo failed", err);
        return null;
      }
    };

    const mapDbIpToSupportedCity = (data: any): City | null => {
      const cityName: string | null = typeof data?.city === "string" ? data.city : null;
      const countryName: string | null =
        typeof data?.countryName === "string" ? data.countryName : null;

      if (cityName) {
        const normCity = normalize(cityName);
        const direct =
          SHAKE_CITIES.find((c) => normalize(c.name) === normCity) ??
          SHAKE_CITIES.find(
            (c) => normalize(c.name).includes(normCity) || normCity.includes(normalize(c.name)),
          );
        if (direct) return direct;
      }

      if (countryName) {
        const normCountry = normalize(countryName);
        const inCountry = SHAKE_CITIES.filter((c) => {
          const cCountry = normalize(c.country);
          return cCountry === normCountry || cCountry.includes(normCountry) || normCountry.includes(cCountry);
        });

        if (inCountry.length === 1) return inCountry[0];
        if (inCountry.length > 1 && cityName) {
          const normCity = normalize(cityName);
          const best = inCountry.find((c) => {
            const n = normalize(c.name);
            return n.includes(normCity) || normCity.includes(n);
          });
          if (best) return best;
        }

        if (inCountry.length > 0) return inCountry[0];
      }

      return null;
    };

    const tryDbIpCoordsOrCity = async (): Promise<{ lat: number; lng: number } | City | null> => {
      console.log("[CityContext] IP fallback: db-ip start");
      try {
        const response = await fetch("https://api.db-ip.com/v2/free/self", {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.warn("[CityContext] IP fallback: db-ip non-OK", response.status);
          return null;
        }

        const data = await response.json();

        const lat = Number(data?.latitude);
        const lng = Number(data?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          console.log("[CityContext] IP fallback: db-ip success coords", {
            lat,
            lng,
            city: data?.city,
          });
          return { lat, lng };
        }

        console.warn("[CityContext] IP fallback: db-ip missing coords; mapping by city/country", {
          city: data?.city,
          countryName: data?.countryName,
        });

        const mapped = mapDbIpToSupportedCity(data);
        if (mapped) {
          console.log("[CityContext] IP fallback: db-ip mapped to supported city", {
            mappedCity: mapped.name,
          });
          return mapped;
        }

        return null;
      } catch (err) {
        console.warn("[CityContext] IP fallback: db-ip failed", err);
        return null;
      }
    };

    try {
      const ipInfo = await tryIpInfo();
      const coordsOrCity = ipInfo ? ipInfo : await tryDbIpCoordsOrCity();
      clearTimeout(timeoutId);

      if (!coordsOrCity) {
        console.warn(
          "[CityContext] IP fallback: both services failed, leaving selectedCity=null",
        );
        fallbackToDefault();
        return;
      }

      if ("lat" in coordsOrCity && "lng" in coordsOrCity) {
        const { city: closestCity, distanceKm } = findClosestCity(coordsOrCity.lat, coordsOrCity.lng);
        console.log("[CityContext] IP fallback: resolved closest city", {
          closestCity: closestCity.name,
          distanceKm,
        });

        if (distanceKm <= 500) setCity(closestCity);
        else setCityOutOfRange(closestCity);
        return;
      }

      const mappedCity = coordsOrCity as City;
      setCity(mappedCity);
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
          console.warn("[CityContext] Geolocation denied/failed - falling back to IP");
          fallbackToIpGeolocation();
        },
        { timeout: 5000, enableHighAccuracy: false },
      );
    } else {
      console.warn("[CityContext] Geolocation not supported - falling back to IP");
      fallbackToIpGeolocation();
    }
  };

  return (
    <CityContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        revertToDetectedLocation,
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
