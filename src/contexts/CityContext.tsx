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
/** "1" / "true" = user picked from city list; "0" / "false" = auto-detected selection */
const SHAKE_MANUAL_CITY_LS = "shake_city_manual_selection";

function isValidCityName(name: string | null | undefined): boolean {
  if (!name) return false;
  return SHAKE_CITIES.some((c) => c.name === name);
}

/** Synchronous read on first render — must stay in sync with setSelectedCity / revertToDetectedLocation */
function readPersistedCity(): string | null {
  try {
    const v = localStorage.getItem(SHAKE_SELECTED_CITY_LS);
    return isValidCityName(v) ? v : null;
  } catch {
    return null;
  }
}

function writeManualFlag(manual: boolean) {
  try {
    localStorage.setItem(SHAKE_MANUAL_CITY_LS, manual ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * True if the user explicitly chose a city from the picker (not GPS/IP auto-assign).
 * Out-of-range checks use `SHAKE_CITIES` from `@/data/cities` (exact `name` match, e.g. "New York City").
 */
function readPersistedManual(): boolean {
  try {
    const v = localStorage.getItem(SHAKE_MANUAL_CITY_LS);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
    // Legacy: had a saved city before we tracked manual — treat as manual so Events/API aren't blocked
    const city = localStorage.getItem(SHAKE_SELECTED_CITY_LS);
    return isValidCityName(city);
  } catch {
    return false;
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
  /** User chose a city from the picker; false when selection came from auto GPS/IP detection */
  isManuallySelected: boolean;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<string | null>(() => readPersistedCity());
  const [detectedCity, setDetectedCity] = useState<City | null>(null);
  /** If user already has a valid saved city, don't block the UI (Events, etc.) waiting for GPS/IP */
  const [isLoading, setIsLoading] = useState(() => !readPersistedCity());
  const [isCityOutOfRange, setIsCityOutOfRange] = useState(false);
  const [isManuallySelected, setIsManuallySelected] = useState(() => readPersistedManual());

  const setSelectedCity = useCallback((city: string) => {
    if (!isValidCityName(city)) return;
    try {
      localStorage.setItem(SHAKE_SELECTED_CITY_LS, city);
    } catch {
      /* ignore quota */
    }
    writeManualFlag(true);
    setIsManuallySelected(true);
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
    writeManualFlag(false);
    setIsManuallySelected(false);
    setSelectedCityState(detectedCity.name);
    setIsCityOutOfRange(false);
  }, [detectedCity]);

  const setCity = (city: City, displayOnly: boolean) => {
    setDetectedCity(city);
    setIsCityOutOfRange(false);
    if (!displayOnly) {
      if (!readPersistedCity()) {
        setSelectedCityState(city.name);
        try {
          localStorage.setItem(SHAKE_SELECTED_CITY_LS, city.name);
        } catch {
          /* ignore */
        }
        writeManualFlag(false);
        setIsManuallySelected(false);
      }
      setIsLoading(false);
    }
  };

  const setCityOutOfRange = (city: City, displayOnly: boolean) => {
    setDetectedCity(city);
    setIsCityOutOfRange(true);
    if (!displayOnly) {
      if (!readPersistedCity()) {
        setSelectedCityState(null);
        writeManualFlag(false);
        setIsManuallySelected(false);
      }
      setIsLoading(false);
    }
  };

  const fallbackToDefault = (displayOnly: boolean) => {
    setIsCityOutOfRange(false);
    setDetectedCity(null);
    if (!displayOnly) {
      if (!readPersistedCity()) {
        setSelectedCityState(null);
        writeManualFlag(false);
        setIsManuallySelected(false);
      }
      setIsLoading(false);
    }
  };

  const fallbackToIpGeolocation = async (displayOnly: boolean) => {
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
          "[CityContext] IP fallback: both services failed",
          displayOnly ? "(displayOnly: keep saved selection)" : "leaving selectedCity unset if no persistence",
        );
        fallbackToDefault(displayOnly);
        return;
      }

      if ("lat" in coordsOrCity && "lng" in coordsOrCity) {
        const { city: closestCity, distanceKm } = findClosestCity(coordsOrCity.lat, coordsOrCity.lng);
        console.log("[CityContext] IP fallback: resolved closest city", {
          closestCity: closestCity.name,
          distanceKm,
          displayOnly,
        });

        if (distanceKm <= 500) setCity(closestCity, displayOnly);
        else setCityOutOfRange(closestCity, displayOnly);
        return;
      }

      const mappedCity = coordsOrCity as City;
      setCity(mappedCity, displayOnly);
    } catch (error) {
      console.warn("[CityContext] IP geolocation error (outer):", error);
      fallbackToDefault(displayOnly);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const detectLocation = (options?: { displayOnly?: boolean }) => {
    const displayOnly = options?.displayOnly ?? false;

    if (!displayOnly) {
      setIsLoading(true);
    }
    console.log("[CityContext] detectLocation start", { displayOnly, hasPersistedCity: Boolean(readPersistedCity()) });

    let didSettle = false;

    if ("geolocation" in navigator) {
      const geoTimeout = setTimeout(() => {
        if (didSettle) return;
        didSettle = true;
        console.log("Geolocation timeout - falling back to IP");
        void fallbackToIpGeolocation(displayOnly);
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (didSettle) return;
          didSettle = true;
          clearTimeout(geoTimeout);

          const { latitude, longitude } = position.coords;
          console.log("[CityContext] Geolocation success", { latitude, longitude, displayOnly });
          const { city: closestCity, distanceKm } = findClosestCity(latitude, longitude);
          console.log("[CityContext] Geolocation closest city", { closestCity: closestCity.name, distanceKm });

          // Only keep displayOnly=true if the user *explicitly* chose their city from the
          // picker (SHAKE_MANUAL_CITY_LS === "1"). A stale auto-detected city saved by a
          // previous session should be overridden by a fresh GPS fix.
          let wasExplicitManual = false;
          try {
            wasExplicitManual = localStorage.getItem(SHAKE_MANUAL_CITY_LS) === "1";
          } catch { /* ignore */ }
          const effectiveDisplayOnly = displayOnly && wasExplicitManual;

          if (distanceKm <= 500) {
            setCity(closestCity, effectiveDisplayOnly);
          } else {
            setCityOutOfRange(closestCity, effectiveDisplayOnly);
          }
        },
        () => {
          if (didSettle) return;
          didSettle = true;
          clearTimeout(geoTimeout);
          console.warn("[CityContext] Geolocation denied/failed - falling back to IP");
          void fallbackToIpGeolocation(displayOnly);
        },
        { timeout: 5000, enableHighAccuracy: false },
      );
    } else {
      console.warn("[CityContext] Geolocation not supported - falling back to IP");
      void fallbackToIpGeolocation(displayOnly);
    }
  };

  useEffect(() => {
    const saved = readPersistedCity();
    if (saved) {
      // Manual selection wins: keep selectedCity from localStorage; still resolve GPS/IP for "Your location" / revert
      detectLocation({ displayOnly: true });
    } else {
      detectLocation({ displayOnly: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CityContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        revertToDetectedLocation,
        detectedCity,
        isLoading,
        isCityOutOfRange,
        isManuallySelected,
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
