import { useRef, useEffect, useState, useMemo } from "react";
import { SHAKE_CITIES, City, findClosestCity } from "@/data/cities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityColor } from "@/data/activityTypes";
import { cn } from "@/lib/utils";

interface WorldMapProps {
  activities: UserActivity[];
  onActivityClick: (activity: UserActivity) => void;
  onCityClick?: (city: City) => void;
  selectedActivityId?: string | null;
  initialCity?: string;
}

// Simple equirectangular projection
const projectCoords = (lat: number, lng: number, width: number, height: number) => {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
};

export function WorldMap({ activities, onActivityClick, onCityClick, selectedActivityId, initialCity }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const hasInitialized = useRef(false);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height: Math.max(height, width * 0.5) });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Get user's geolocation and center map
  useEffect(() => {
    if (hasInitialized.current) return;
    
    // If we have an initial city, use that
    if (initialCity) {
      const city = SHAKE_CITIES.find(c => c.name === initialCity);
      if (city) {
        setUserLocation({ lat: city.lat, lng: city.lng });
        // Calculate pan to center on city
        const { x, y } = projectCoords(city.lat, city.lng, dimensions.width, dimensions.height);
        setPan({
          x: dimensions.width / 2 - x,
          y: dimensions.height / 2 - y,
        });
        setZoom(2);
        hasInitialized.current = true;
        return;
      }
    }

    // Try to get user's location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          // Center map on user's location
          const { x, y } = projectCoords(latitude, longitude, dimensions.width, dimensions.height);
          setPan({
            x: dimensions.width / 2 - x,
            y: dimensions.height / 2 - y,
          });
          setZoom(2);
          hasInitialized.current = true;
        },
        () => {
          // Fallback: center on a default location if geolocation fails
          hasInitialized.current = true;
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, [initialCity, dimensions.width, dimensions.height]);

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

  // Get city coordinates with activities
  const cityMarkers = useMemo(() => {
    return Object.entries(activitiesByCity).map(([key, cityActivities]) => {
      const city = SHAKE_CITIES.find(
        (c) => `${c.lat}-${c.lng}` === key
      );
      if (!city) return null;
      
      const { x, y } = projectCoords(city.lat, city.lng, dimensions.width, dimensions.height);
      return {
        city,
        activities: cityActivities,
        x: (x + pan.x) * zoom,
        y: (y + pan.y) * zoom,
      };
    }).filter(Boolean);
  }, [activitiesByCity, dimensions, zoom, pan]);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 1), 5));
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x * zoom, y: e.clientY - pan.y * zoom });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: (e.clientX - dragStart.x) / zoom,
        y: (e.clientY - dragStart.y) / zoom,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] overflow-hidden rounded-xl bg-gradient-to-b from-background to-muted/30 cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* World map background SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "center center",
        }}
      >
        <rect x="0" y="0" width="800" height="400" fill="transparent" />

        {/* Continents (stylized silhouette for context) */}
        <g className="text-muted-foreground" opacity={0.22}>
          {/* North America */}
          <path
            d="M85 115 C95 85 140 70 175 82 C205 92 220 110 238 122 C255 132 270 138 275 155 C282 178 260 196 235 200 C210 204 196 194 174 186 C152 178 132 176 116 160 C97 142 78 137 85 115 Z"
            fill="currentColor"
          />
          {/* South America */}
          <path
            d="M225 225 C250 214 272 228 280 250 C288 272 276 284 270 304 C264 326 250 346 232 352 C212 358 198 344 202 324 C206 304 190 292 198 272 C206 252 205 236 225 225 Z"
            fill="currentColor"
          />
          {/* Europe */}
          <path
            d="M360 120 C374 106 404 102 420 112 C432 120 438 132 452 134 C468 136 482 132 492 142 C506 156 486 170 468 172 C446 174 438 186 420 186 C400 186 388 176 378 162 C368 148 350 136 360 120 Z"
            fill="currentColor"
          />
          {/* Africa */}
          <path
            d="M420 205 C442 188 468 194 486 210 C506 228 518 246 512 272 C506 298 484 312 476 332 C468 352 444 360 426 350 C408 340 406 320 396 300 C386 280 378 264 388 244 C398 224 402 220 420 205 Z"
            fill="currentColor"
          />
          {/* Asia */}
          <path
            d="M485 110 C512 84 560 84 598 98 C632 110 650 118 682 118 C712 118 730 134 728 154 C726 172 706 184 688 188 C664 194 650 184 630 176 C608 166 592 170 574 178 C554 188 534 186 520 170 C506 154 476 138 485 110 Z"
            fill="currentColor"
          />
          {/* Australia */}
          <path
            d="M645 295 C664 278 694 280 716 292 C736 304 738 324 722 336 C706 348 684 350 664 344 C642 336 626 314 645 295 Z"
            fill="currentColor"
          />
        </g>

        {/* Grid lines */}
        <g className="text-border" opacity={0.35}>
          {[...Array(19)].map((_, i) => (
            <line
              key={`lat-${i}`}
              x1="0"
              y1={i * (400 / 18)}
              x2="800"
              y2={i * (400 / 18)}
              stroke="currentColor"
              strokeWidth="0.75"
            />
          ))}
          {[...Array(37)].map((_, i) => (
            <line
              key={`lng-${i}`}
              x1={i * (800 / 36)}
              y1="0"
              x2={i * (800 / 36)}
              y2="400"
              stroke="currentColor"
              strokeWidth="0.75"
            />
          ))}
        </g>
      </svg>

      {/* Activity markers */}
      {cityMarkers.map((marker) => {
        if (!marker) return null;
        const { city, activities: cityActivities, x, y } = marker;
        const topActivity = cityActivities[0];
        const isSelected = cityActivities.some((a) => a.id === selectedActivityId);
        const isHovered = cityActivities.some((a) => a.id === hoveredActivity);

        return (
          <div
            key={`${city.lat}-${city.lng}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: x, top: y }}
          >
            <button
              onClick={() => {
                if (cityActivities.length === 1) {
                  onActivityClick(topActivity);
                } else if (onCityClick) {
                  onCityClick(city);
                }
              }}
              onMouseEnter={() => setHoveredActivity(topActivity.id)}
              onMouseLeave={() => setHoveredActivity(null)}
              className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-200",
                "shadow-lg hover:shadow-xl",
                isSelected || isHovered ? "scale-125 z-20" : "hover:scale-110",
                getActivityColor(topActivity.activity_type)
              )}
              style={{
                width: Math.max(32, 24 + cityActivities.length * 4) * (zoom > 2 ? 1 : zoom * 0.5 + 0.5),
                height: Math.max(32, 24 + cityActivities.length * 4) * (zoom > 2 ? 1 : zoom * 0.5 + 0.5),
              }}
            >
              <span className="text-lg">{getActivityEmoji(topActivity.activity_type)}</span>
              {cityActivities.length > 1 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cityActivities.length}
                </span>
              )}
            </button>

            {/* Tooltip on hover */}
            {isHovered && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 pointer-events-none">
                <div className="bg-popover text-popover-foreground text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap border border-border">
                  <p className="font-semibold">{city.name}</p>
                  <p className="text-muted-foreground">
                    {cityActivities.length} {cityActivities.length === 1 ? "plan" : "plans"}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom((prev) => Math.min(prev * 1.2, 5))}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-foreground hover:bg-card transition-colors border border-border"
        >
          +
        </button>
        <button
          onClick={() => setZoom((prev) => Math.max(prev * 0.8, 1))}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-foreground hover:bg-card transition-colors border border-border"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-foreground hover:bg-card transition-colors border border-border text-xs"
        >
          ⌂
        </button>
      </div>

      {/* User location marker */}
      {userLocation && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-5"
          style={{
            left: (projectCoords(userLocation.lat, userLocation.lng, dimensions.width, dimensions.height).x + pan.x) * zoom,
            top: (projectCoords(userLocation.lat, userLocation.lng, dimensions.width, dimensions.height).y + pan.y) * zoom,
          }}
        >
          <div className="relative">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
            <div className="absolute inset-0 w-4 h-4 bg-blue-500/30 rounded-full animate-ping" />
          </div>
        </div>
      )}

      {/* Empty state - show message but keep map visible */}
      {activities.length === 0 && (
        <div className="absolute bottom-4 left-4 z-20">
          <div className="px-4 py-2 bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
            <p className="text-sm font-medium text-foreground">No plans yet</p>
            <p className="text-xs text-muted-foreground">Be the first to create one!</p>
          </div>
        </div>
      )}
    </div>
  );
}