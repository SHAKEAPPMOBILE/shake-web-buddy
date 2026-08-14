import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VenuePlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface VenueSearchInputProps {
  value: string;
  onChange: (text: string) => void;
  onSelectPlace: (place: VenuePlace) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Free-text venue input with live place suggestions. Biased toward the
 * user's current location (via browser geolocation, best-effort — silently
 * does without it if denied/unavailable) using Photon (komoot's free,
 * keyless geocoding API built on OpenStreetMap data — no billing account
 * required). Users can always just type a venue name and move on without
 * picking a suggestion.
 */
export function VenueSearchInput({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  className,
  inputClassName,
}: VenueSearchInputProps) {
  const [suggestions, setSuggestions] = useState<VenuePlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guards against out-of-order responses: a slower earlier request landing
  // after a newer one shouldn't overwrite the dropdown with stale results.
  const requestIdRef = useRef(0);

  // Best-effort proximity bias — never blocks or errors visibly if denied.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => { /* denied or unavailable — search still works without bias */ },
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "5");
      const coords = coordsRef.current;
      if (coords) {
        url.searchParams.set("lat", String(coords.lat));
        url.searchParams.set("lon", String(coords.lng));
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Photon geocoding failed: ${res.status}`);
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // a newer request already landed

      const places: VenuePlace[] = (data.features || [])
        .map((f: any) => {
          const p = f.properties || {};
          const name: string = p.name || p.street || p.city || "";
          const addressParts = [
            p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
            p.city,
            p.state,
            p.country,
          ].filter(Boolean);
          return {
            name,
            address: addressParts.join(", ") || name,
            lat: f.geometry?.coordinates?.[1],
            lng: f.geometry?.coordinates?.[0],
          };
        })
        .filter((p: VenuePlace) => p.name && typeof p.lat === "number" && typeof p.lng === "number");
      setSuggestions(places);
      setIsOpen(places.length > 0);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.warn("[VenueSearchInput] suggestion fetch failed", err);
      setSuggestions([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const handleInputChange = (text: string) => {
    onChange(text);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(text), 300);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full h-14 pl-10 pr-10 rounded-2xl border border-border bg-muted/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40",
            inputClassName
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl border border-border bg-background shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((place, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelectPlace(place);
                setIsOpen(false);
                setSuggestions([]);
              }}
              className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                <p className="text-xs text-muted-foreground truncate">{place.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
