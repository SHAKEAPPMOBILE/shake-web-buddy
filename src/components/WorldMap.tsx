import { useRef, useEffect, useState, useMemo, useImperativeHandle, forwardRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { SHAKE_CITIES, City } from "@/data/cities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityColor } from "@/data/activityTypes";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

// Mapbox public token (publishable key - safe for frontend)
const MAPBOX_TOKEN = "pk.eyJ1IjoibGVvbmVsbWVuZXNlcyIsImEiOiJjbWpoOHdmMTgwb2EzM2Rxdmh5ODRmZ29rIn0.b8ghz8NdmX7Tqr56BM6kfg";

export interface WorldMapHandle {
  flyToCity: (cityName: string) => void;
}

interface WorldMapProps {
  activities: UserActivity[];
  onActivityClick: (activity: UserActivity) => void;
  onCityClick?: (city: City) => void;
  selectedActivityId?: string | null;
  initialCity?: string;
}

export const WorldMap = forwardRef<WorldMapHandle, WorldMapProps>(function WorldMap({ 
  activities, 
  onActivityClick, 
  onCityClick, 
  selectedActivityId, 
  initialCity 
}, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

  // Expose flyToCity method via ref
  useImperativeHandle(ref, () => ({
    flyToCity: (cityName: string) => {
      if (!map.current || !mapLoaded) return;
      const city = SHAKE_CITIES.find((c) => c.name === cityName);
      if (!city) return;
      map.current.flyTo({
        center: [city.lng, city.lat],
        zoom: 11,
        duration: 1500,
      });
    },
  }), [mapLoaded]);

  // Create activities with random offsets for positioning
  const activitiesWithPositions = useMemo(() => {
    return activities.map((activity, index) => {
      const city = SHAKE_CITIES.find((c) => c.name === activity.city);
      if (!city) return null;
      
      // Generate consistent random offset based on activity id
      const seed = activity.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const offsetLng = ((seed % 100) - 50) * 0.001; // ~±0.05 degrees
      const offsetLat = (((seed * 7) % 100) - 50) * 0.001;
      
      return {
        activity,
        lng: city.lng + offsetLng,
        lat: city.lat + offsetLat,
      };
    }).filter(Boolean) as { activity: UserActivity; lng: number; lat: number }[];
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

    // Add individual markers for each activity
    activitiesWithPositions.forEach(({ activity, lng, lat }) => {
      const isSelected = activity.id === selectedActivityId;

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "activity-marker";
      el.innerHTML = `
        <div class="relative flex items-center justify-center rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 ${
          isSelected ? "scale-125 ring-2 ring-primary ring-offset-2" : ""
        } ${getActivityColor(activity.activity_type)}" style="width: 40px; height: 40px;">
          <span class="text-lg">${getActivityEmoji(activity.activity_type)}</span>
        </div>
      `;

      // Add click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onActivityClick(activity);
      });

      // Add hover handlers
      el.addEventListener("mouseenter", () => {
        setHoveredActivity(activity.id);
      });
      el.addEventListener("mouseleave", () => {
        setHoveredActivity(null);
      });

      const creatorName = activity.creator_name || "Someone";
      const note = activity.note ? `<p class="text-xs italic mt-1">"${activity.note}"</p>` : "";
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="text-sm p-1">
              <p class="font-semibold">${getActivityEmoji(activity.activity_type)} ${activity.activity_type}</p>
              <p class="text-muted-foreground">by ${creatorName}</p>
              ${note}
              <p class="text-xs text-muted-foreground mt-1">${activity.city}</p>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [activitiesWithPositions, mapLoaded, selectedActivityId, onActivityClick]);

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
});
