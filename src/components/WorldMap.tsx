import { useRef, useEffect, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { SHAKE_CITIES, City } from "@/data/cities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityColor } from "@/data/activityTypes";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

// Set Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || "";

interface WorldMapProps {
  activities: UserActivity[];
  onActivityClick: (activity: UserActivity) => void;
  onCityClick?: (city: City) => void;
  selectedActivityId?: string | null;
  initialCity?: string;
}

export function WorldMap({ 
  activities, 
  onActivityClick, 
  onCityClick, 
  selectedActivityId, 
  initialCity 
}: WorldMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

  // Group activities by city
  const activitiesByCity = useMemo(() => {
    const grouped: Record<string, UserActivity[]> = {};
    activities.forEach((activity) => {
      const city = SHAKE_CITIES.find((c) => c.name === activity.city);
      if (city) {
        const key = `${city.lat}-${city.lng}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(activity);
      }
    });
    return grouped;
  }, [activities]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      console.error("Mapbox token not found");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Find initial center
    let initialCenter: [number, number] = [0, 20];
    let initialZoom = 2;

    if (initialCity) {
      const city = SHAKE_CITIES.find((c) => c.name === initialCity);
      if (city) {
        initialCenter = [city.lng, city.lat];
        initialZoom = 10;
      }
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: false,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, [initialCity]);

  // Update markers when activities change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    Object.entries(activitiesByCity).forEach(([key, cityActivities]) => {
      const city = SHAKE_CITIES.find((c) => `${c.lat}-${c.lng}` === key);
      if (!city) return;

      const topActivity = cityActivities[0];
      const isSelected = cityActivities.some((a) => a.id === selectedActivityId);

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "activity-marker";
      el.innerHTML = `
        <div class="relative flex items-center justify-center rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 ${
          isSelected ? "scale-125 ring-2 ring-primary ring-offset-2" : ""
        } ${getActivityColor(topActivity.activity_type)}" style="width: ${Math.max(36, 28 + cityActivities.length * 4)}px; height: ${Math.max(36, 28 + cityActivities.length * 4)}px;">
          <span class="text-lg">${getActivityEmoji(topActivity.activity_type)}</span>
          ${
            cityActivities.length > 1
              ? `<span class="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">${cityActivities.length}</span>`
              : ""
          }
        </div>
      `;

      // Add click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (cityActivities.length === 1) {
          onActivityClick(topActivity);
        } else if (onCityClick) {
          onCityClick(city);
        }
      });

      // Add hover handlers
      el.addEventListener("mouseenter", () => {
        setHoveredActivity(topActivity.id);
      });
      el.addEventListener("mouseleave", () => {
        setHoveredActivity(null);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([city.lng, city.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="text-sm">
              <p class="font-semibold">${city.name}</p>
              <p class="text-muted-foreground">${cityActivities.length} ${cityActivities.length === 1 ? "plan" : "plans"}</p>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [activitiesByCity, mapLoaded, selectedActivityId, onActivityClick, onCityClick]);

  // Handle selected activity change - fly to it
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedActivityId) return;

    const activity = activities.find((a) => a.id === selectedActivityId);
    if (!activity) return;

    const city = SHAKE_CITIES.find((c) => c.name === activity.city);
    if (!city) return;

    map.current.flyTo({
      center: [city.lng, city.lat],
      zoom: 12,
      duration: 1500,
    });
  }, [selectedActivityId, activities, mapLoaded]);

  // Show placeholder if no token
  if (!MAPBOX_TOKEN) {
    return (
      <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-muted/30 rounded-xl">
        <div className="text-center p-4">
          <p className="text-muted-foreground">Map requires configuration</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Please add MAPBOX_PUBLIC_TOKEN to your environment
          </p>
        </div>
      </div>
    );
  }

  const handleCenterOnCity = () => {
    if (!map.current || !initialCity) return;
    
    const city = SHAKE_CITIES.find((c) => c.name === initialCity);
    if (!city) return;

    map.current.flyTo({
      center: [city.lng, city.lat],
      zoom: 10,
      duration: 1500,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div 
        ref={mapContainer} 
        className="absolute inset-0 rounded-xl overflow-hidden"
      />
      
      {/* Center on city button */}
      {mapLoaded && initialCity && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCenterOnCity}
          className="absolute bottom-4 left-4 z-10 gap-1.5 shadow-lg"
        >
          <LocateFixed className="w-4 h-4" />
          Center on {initialCity}
        </Button>
      )}
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
