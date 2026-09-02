import * as React from "react";
import { useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import { SHAKE_CITIES, City } from "@/data/cities";
import { getActivityEmoji, getActivityColor } from "@/data/activityTypes";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

// Free raster basemap — Esri's dark-gray canvas tiles, no API key or billing
// required. Was CARTO's dark-matter tiles until CARTO gated their free
// anonymous endpoint behind a required API key (basemaps.cartocdn.com now
// serves an "API KEY REQUIRED" watermark instead of real map tiles).
const FREE_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-dark-gray": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com">Esri</a>',
    },
  },
  layers: [
    {
      id: "esri-dark-gray-layer",
      type: "raster",
      source: "esri-dark-gray",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export interface WorldMapHandle {
  flyToCity: (cityName: string) => void;
}

// Popup content is built via .setHTML() with user-generated text (plan note,
// creator name, city) interpolated in — escape it first so a plan note like
// `<img src=x onerror=...>` can't execute in another shaker's browser.
function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

// Minimal shape the map actually needs — kept decoupled from any specific
// activity/plan type so both the (unwired) PlansMapDialog's UserActivity[]
// and the iOS PlansTab's PlanActivity[] can be passed in directly.
export interface WorldMapActivity {
  id: string;
  activity_type: string;
  city: string;
  note?: string | null;
  creator_name?: string;
  creator_avatar?: string | null;
  // Exact place the plan is happening, if the creator tagged one via
  // VenueSearchInput. When absent, the marker falls back to a random
  // jittered position around the city center (see activitiesWithPositions).
  venue_lat?: number | null;
  venue_lng?: number | null;
}

interface WorldMapProps {
  activities: WorldMapActivity[];
  onActivityClick: (activity: WorldMapActivity) => void;
  onCityClick?: (city: City) => void;
  selectedActivityId?: string | null;
  initialCity?: string;
}

interface ClusterPointProps {
  activityId: string;
}

// Avatar/marker diameter scales down as you zoom out so a busy area doesn't
// turn into a wall of overlapping circles before clustering even kicks in,
// and scales up close in where there's room to actually see faces.
function markerSizeForZoom(zoom: number): number {
  const clamped = Math.max(2, Math.min(16, zoom));
  return Math.round(24 + ((clamped - 2) / 14) * 24); // 24px at zoom 2 → 48px at zoom 16
}

export const WorldMap = forwardRef<WorldMapHandle, WorldMapProps>(function WorldMap({ 
  activities, 
  onActivityClick, 
  onCityClick, 
  selectedActivityId, 
  initialCity 
}, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const clusterIndexRef = useRef<Supercluster<ClusterPointProps> | null>(null);
  const activityByIdRef = useRef<Map<string, WorldMapActivity>>(new Map());
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

  // Position each activity: exact venue coordinates when the creator tagged
  // one, otherwise a random-but-consistent jitter around the city center so
  // untagged plans still show "approximately here" rather than stacking on
  // a single point.
  const activitiesWithPositions = useMemo(() => {
    return activities.map((activity, index) => {
      if (typeof activity.venue_lat === "number" && typeof activity.venue_lng === "number") {
        return { activity, lng: activity.venue_lng, lat: activity.venue_lat };
      }

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
    }).filter(Boolean) as { activity: WorldMapActivity; lng: number; lat: number }[];
  }, [activities]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_DARK_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      // OSM/CARTO's free tiles require attribution to stay visible — using
      // the default control here so we can set compact:true instead of
      // dropping it, which collapses it to a small "i" icon rather than
      // removing it outright.
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.AttributionControl({ compact: true }));

    // Add navigation controls
    map.current.addControl(
      new maplibregl.NavigationControl({
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

  // Build one individual-activity marker element — creator avatar with a small
  // activity-emoji badge, falling back to a plain colored emoji circle when
  // there's no avatar. Built via DOM APIs (not innerHTML string concatenation)
  // since creator_avatar is a user-supplied URL. Sized to the current zoom.
  const createActivityMarkerEl = useCallback((activity: WorldMapActivity, isSelected: boolean, size: number) => {
    const el = document.createElement("div");
    el.className = "activity-marker relative cursor-pointer transition-transform duration-200 hover:scale-110";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    const circle = document.createElement("div");
    const baseCircleClass = (colorClass: string) => [
      "w-full h-full rounded-full shadow-lg overflow-hidden flex items-center justify-center border-2 border-white",
      isSelected ? "scale-125 ring-2 ring-primary ring-offset-2" : "",
      colorClass,
    ].filter(Boolean).join(" ");
    circle.className = baseCircleClass(activity.creator_avatar ? "bg-muted" : getActivityColor(activity.activity_type));

    const renderEmojiFallback = () => {
      circle.replaceChildren();
      circle.className = baseCircleClass(getActivityColor(activity.activity_type));
      const span = document.createElement("span");
      span.className = "text-lg";
      span.textContent = getActivityEmoji(activity.activity_type);
      circle.appendChild(span);
    };

    if (activity.creator_avatar) {
      const img = document.createElement("img");
      img.src = activity.creator_avatar;
      img.alt = "";
      img.className = "w-full h-full object-cover";
      img.onerror = renderEmojiFallback;
      circle.appendChild(img);

      const badge = document.createElement("span");
      badge.className = "absolute -bottom-1 -right-1 text-xs bg-white rounded-full w-5 h-5 flex items-center justify-center shadow";
      badge.textContent = getActivityEmoji(activity.activity_type);
      el.appendChild(circle);
      el.appendChild(badge);
    } else {
      renderEmojiFallback();
      el.appendChild(circle);
    }

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onActivityClick(activity);
    });
    el.addEventListener("mouseenter", () => setHoveredActivity(activity.id));
    el.addEventListener("mouseleave", () => setHoveredActivity(null));

    return el;
  }, [onActivityClick]);

  // Cluster bubble — plain count badge, no avatar (clusters can span many
  // different creators). Tapping it zooms in to the point where supercluster
  // would break it apart into smaller clusters/individual markers.
  const createClusterMarkerEl = useCallback((count: number, size: number) => {
    const el = document.createElement("div");
    el.className = "cluster-marker rounded-full shadow-lg flex items-center justify-center border-2 border-white bg-primary text-primary-foreground font-bold cursor-pointer transition-transform duration-200 hover:scale-110";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.fontSize = count >= 100 ? "12px" : "13px";
    el.textContent = count >= 100 ? "99+" : String(count);
    return el;
  }, []);

  // Rebuild the cluster index whenever the underlying activity set changes.
  useEffect(() => {
    activityByIdRef.current = new Map(activitiesWithPositions.map(({ activity }) => [activity.id, activity]));

    const points: Supercluster.PointFeature<ClusterPointProps>[] = activitiesWithPositions.map(({ activity, lng, lat }) => ({
      type: "Feature",
      properties: { activityId: activity.id },
      geometry: { type: "Point", coordinates: [lng, lat] },
    }));

    const index = new Supercluster<ClusterPointProps>({ radius: 50, maxZoom: 16 });
    index.load(points);
    clusterIndexRef.current = index;
  }, [activitiesWithPositions]);

  // Query the cluster index for the current viewport/zoom and (re)render markers.
  const renderMarkers = useCallback(() => {
    if (!map.current || !clusterIndexRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = map.current.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ];
    const zoom = map.current.getZoom();
    const clusters = clusterIndexRef.current.getClusters(bbox, Math.round(zoom));
    const size = markerSizeForZoom(zoom);

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;

      if ((feature.properties as any).cluster) {
        const clusterId = (feature.properties as any).cluster_id as number;
        const count = (feature.properties as any).point_count as number;
        const el = createClusterMarkerEl(count, Math.max(size, 32));
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const expansionZoom = Math.min(clusterIndexRef.current!.getClusterExpansionZoom(clusterId), 18);
          map.current!.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
        });
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.current!));
        return;
      }

      const activityId = (feature.properties as ClusterPointProps).activityId;
      const activity = activityByIdRef.current.get(activityId);
      if (!activity) return;

      const isSelected = activity.id === selectedActivityId;
      const el = createActivityMarkerEl(activity, isSelected, size);

      const creatorName = escapeHtml(activity.creator_name || "Someone");
      const note = activity.note ? `<p class="text-xs italic mt-1">"${escapeHtml(activity.note)}"</p>` : "";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="text-sm p-1">
              <p class="font-semibold">${getActivityEmoji(activity.activity_type)} ${escapeHtml(activity.activity_type)}</p>
              <p class="text-muted-foreground">by ${creatorName}</p>
              ${note}
              <p class="text-xs text-muted-foreground mt-1">${escapeHtml(activity.city)}</p>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [createActivityMarkerEl, createClusterMarkerEl, selectedActivityId]);

  // Re-render on pan/zoom (moveend covers both) and whenever the underlying
  // data or render inputs change.
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    renderMarkers();
    const map_ = map.current;
    map_.on("moveend", renderMarkers);
    return () => { map_.off("moveend", renderMarkers); };
  }, [mapLoaded, renderMarkers, activitiesWithPositions]);

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
