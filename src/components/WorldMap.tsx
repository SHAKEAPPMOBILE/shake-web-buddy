import { useRef, useEffect, useState, useMemo } from "react";
import { SHAKE_CITIES, City } from "@/data/cities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityColor } from "@/data/activityTypes";
import { cn } from "@/lib/utils";

interface WorldMapProps {
  activities: UserActivity[];
  onActivityClick: (activity: UserActivity) => void;
  onCityClick?: (city: City) => void;
  selectedActivityId?: string | null;
}

// Simple equirectangular projection
const projectCoords = (lat: number, lng: number, width: number, height: number) => {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
};

export function WorldMap({ activities, onActivityClick, onCityClick, selectedActivityId }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

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
        className="absolute inset-0 w-full h-full opacity-20"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "center center",
        }}
      >
        {/* Simple world outline */}
        <rect x="0" y="0" width="800" height="400" fill="transparent" />
        {/* Grid lines */}
        {[...Array(19)].map((_, i) => (
          <line
            key={`lat-${i}`}
            x1="0"
            y1={i * (400 / 18)}
            x2="800"
            y2={i * (400 / 18)}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
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
            strokeWidth="0.5"
            className="text-border"
          />
        ))}
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

      {/* Empty state */}
      {activities.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-6 bg-card/80 backdrop-blur-sm rounded-xl border border-border">
            <p className="text-lg font-semibold text-foreground mb-1">No plans yet</p>
            <p className="text-sm text-muted-foreground">Be the first to create a plan!</p>
          </div>
        </div>
      )}
    </div>
  );
}