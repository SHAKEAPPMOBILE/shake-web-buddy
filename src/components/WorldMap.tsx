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

        {/* High-fidelity world map outline */}
        <g className="text-muted-foreground" opacity={0.3}>
          {/* North America */}
          <path
            d="M45,85 L55,75 L70,72 L85,68 L100,65 L115,60 L130,58 L145,55 L160,53 L175,52 L185,55 L195,60 L205,65 L210,72 L215,80 L225,85 L235,82 L245,78 L250,72 L255,65 L260,60 L265,55 L270,52 L278,50 L285,52 L290,58 L285,65 L278,72 L270,80 L265,88 L260,95 L255,102 L250,110 L245,118 L240,125 L235,132 L228,140 L220,148 L212,155 L205,162 L198,168 L190,172 L182,175 L175,180 L168,185 L160,188 L152,190 L145,195 L138,200 L130,202 L122,198 L115,192 L108,185 L100,180 L92,175 L85,168 L78,160 L72,152 L68,145 L65,138 L62,130 L58,122 L55,115 L52,108 L48,100 L45,92 L45,85 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Alaska */}
          <path
            d="M35,72 L45,68 L55,65 L62,70 L58,78 L50,82 L42,80 L35,72 Z M25,82 L32,78 L38,82 L35,88 L28,88 L25,82 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Greenland */}
          <path
            d="M295,42 L310,38 L325,40 L338,45 L348,52 L352,62 L350,72 L345,80 L338,85 L328,88 L318,86 L308,82 L300,75 L295,65 L292,55 L295,42 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Central America & Mexico */}
          <path
            d="M130,202 L138,205 L145,210 L152,215 L158,220 L165,225 L170,232 L175,240 L180,245 L185,250 L190,255 L195,260 L200,265 L205,270 L210,275 L215,280 L218,285 L212,288 L205,285 L198,280 L190,275 L182,270 L175,265 L168,260 L160,255 L152,250 L145,245 L138,242 L130,238 L125,232 L122,225 L120,218 L122,210 L125,205 L130,202 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* South America */}
          <path
            d="M218,285 L225,290 L235,295 L245,298 L255,302 L262,308 L268,315 L272,322 L275,330 L278,338 L280,345 L278,352 L275,360 L270,368 L265,375 L258,382 L250,388 L242,392 L235,395 L228,392 L222,385 L218,378 L215,370 L212,362 L210,355 L208,348 L205,340 L202,332 L200,325 L198,318 L195,310 L192,302 L190,295 L195,290 L205,288 L218,285 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Europe */}
          <path
            d="M365,88 L375,85 L385,82 L395,80 L405,78 L415,80 L425,82 L432,86 L438,90 L445,95 L452,100 L458,105 L462,110 L468,115 L475,118 L482,120 L488,118 L492,112 L498,108 L505,110 L508,116 L505,122 L500,128 L495,132 L488,135 L480,138 L472,142 L465,145 L458,148 L450,150 L442,152 L435,155 L428,158 L420,160 L412,158 L405,155 L398,150 L392,145 L385,140 L378,135 L372,130 L368,125 L365,118 L362,110 L360,102 L362,95 L365,88 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* UK & Ireland */}
          <path
            d="M358,95 L365,92 L370,95 L372,102 L368,108 L362,110 L358,105 L358,95 Z M350,98 L356,96 L358,102 L355,108 L350,106 L350,98 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Scandinavia */}
          <path
            d="M398,55 L408,50 L418,48 L428,52 L435,58 L440,65 L442,72 L438,78 L432,82 L425,82 L418,78 L412,72 L408,65 L405,58 L398,55 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Africa */}
          <path
            d="M380,165 L392,162 L405,160 L418,158 L432,160 L445,162 L458,165 L470,170 L480,175 L488,182 L495,190 L500,200 L505,210 L508,220 L510,232 L512,245 L510,258 L508,270 L505,282 L500,295 L495,305 L488,315 L480,325 L470,332 L460,338 L450,342 L440,345 L430,346 L420,345 L410,342 L400,338 L392,332 L385,325 L380,315 L375,305 L372,295 L370,282 L368,270 L368,258 L370,245 L372,232 L375,220 L378,208 L380,195 L380,182 L378,172 L380,165 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Madagascar */}
          <path
            d="M515,295 L522,290 L528,295 L530,305 L528,318 L522,328 L515,330 L510,322 L510,310 L512,300 L515,295 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Middle East */}
          <path
            d="M480,138 L492,135 L505,138 L515,142 L525,148 L532,155 L538,165 L540,175 L538,185 L532,192 L522,195 L512,192 L502,188 L492,185 L485,180 L480,172 L478,162 L478,152 L480,145 L480,138 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Asia - Russia & Central */}
          <path
            d="M505,50 L520,48 L538,50 L555,52 L572,55 L590,58 L608,60 L625,62 L642,65 L658,68 L675,72 L690,75 L705,78 L718,82 L730,85 L740,90 L748,95 L752,102 L750,110 L745,118 L738,125 L730,128 L720,130 L708,132 L695,130 L682,128 L668,125 L655,122 L642,120 L628,118 L615,115 L602,112 L588,110 L575,108 L562,105 L548,102 L535,100 L522,98 L510,95 L500,90 L495,82 L498,72 L502,62 L505,50 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Asia - India & Southeast */}
          <path
            d="M545,165 L558,162 L572,165 L585,170 L595,178 L602,188 L608,200 L612,212 L610,225 L605,235 L598,242 L588,248 L578,252 L568,250 L558,245 L550,238 L545,228 L542,218 L540,208 L538,198 L540,188 L542,178 L545,165 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Southeast Asia & Indonesia */}
          <path
            d="M615,220 L628,218 L642,222 L655,228 L665,235 L672,245 L675,255 L670,265 L662,272 L652,275 L640,275 L628,272 L618,268 L610,262 L605,252 L605,242 L608,232 L615,220 Z M680,255 L692,252 L705,258 L712,268 L708,278 L698,282 L688,278 L682,268 L680,255 Z M720,265 L732,262 L742,268 L745,278 L740,288 L728,290 L718,285 L715,275 L720,265 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* China, Korea, Japan */}
          <path
            d="M620,110 L635,108 L650,112 L665,118 L678,125 L688,135 L695,145 L698,158 L695,170 L688,180 L678,188 L665,192 L652,190 L640,185 L628,178 L618,168 L612,158 L608,145 L610,132 L615,120 L620,110 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Japan */}
          <path
            d="M710,125 L718,120 L728,122 L735,128 L738,138 L735,148 L728,155 L718,158 L710,155 L705,148 L705,138 L708,130 L710,125 Z M742,140 L750,138 L758,142 L760,150 L755,158 L748,160 L742,155 L740,148 L742,140 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Philippines */}
          <path
            d="M695,205 L702,200 L710,205 L712,215 L708,225 L700,228 L692,222 L692,212 L695,205 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Australia */}
          <path
            d="M645,295 L662,290 L680,288 L698,290 L715,295 L730,302 L742,312 L750,325 L752,340 L748,355 L740,365 L728,372 L712,375 L695,375 L678,372 L662,368 L648,360 L638,350 L632,338 L630,325 L632,312 L638,302 L645,295 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* New Zealand */}
          <path
            d="M768,345 L775,340 L782,345 L785,355 L782,365 L775,372 L768,370 L765,362 L765,352 L768,345 Z M778,368 L785,365 L790,370 L790,378 L785,382 L778,380 L775,375 L778,368 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Papua New Guinea */}
          <path
            d="M745,270 L758,268 L770,272 L778,280 L775,290 L765,295 L752,292 L745,285 L745,278 L745,270 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Iceland */}
          <path
            d="M335,55 L345,52 L355,55 L358,62 L355,68 L345,70 L338,68 L335,62 L335,55 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Caribbean */}
          <path
            d="M192,210 L200,208 L208,212 L210,218 L205,222 L198,222 L192,218 L192,210 Z M215,215 L222,212 L228,218 L225,225 L218,225 L215,220 L215,215 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
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