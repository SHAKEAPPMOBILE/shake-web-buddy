import { useRef } from "react";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DbVenue, getVenueTypeForActivity, getCurrentVenueForActivity } from "@/hooks/useDatabaseVenues";
import { useVenueContext } from "@/contexts/VenueContext";
import { useTranslation } from "react-i18next";

interface VenueSuggestionCarouselProps {
  city: string;
  activityType: string;
  onSuggestVenue: (venue: DbVenue) => void;
}

export function VenueSuggestionCarousel({
  city,
  activityType,
  onSuggestVenue,
}: VenueSuggestionCarouselProps) {
  const { t } = useTranslation();
  const { venues } = useVenueContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get the venue type for this activity
  const venueType = getVenueTypeForActivity(activityType);
  
  // Filter venues for this city and activity type
  const cityVenues = venues.filter(
    (v) => v.city === city && v.venue_type === venueType
  );

  // Don't render if no venues or activity doesn't have venues
  if (!venueType || cityVenues.length === 0) {
    return null;
  }

  // Get the auto-suggested venue (weekly rotation)
  const suggestedVenue = getCurrentVenueForActivity(venues, city, activityType);

  // Sort: suggested venue first, then the rest
  const sortedVenues = suggestedVenue
    ? [suggestedVenue, ...cityVenues.filter(v => v.id !== suggestedVenue.id)]
    : cityVenues;

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="px-4 py-2 border-b border-border/30 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          {t('chat.suggestVenue', 'Suggest a venue')}
        </span>
      </div>
      
      <div className="relative group">
        {/* Left scroll button */}
        {cityVenues.length > 2 && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Venues carousel */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth touch-pan-x"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {sortedVenues.map((venue) => {
            const isSuggested = suggestedVenue?.id === venue.id;
            return (
              <div
                key={venue.id}
                className={`flex-shrink-0 min-w-[180px] max-w-[200px] rounded-lg border p-2.5 shadow-sm ${
                  isSuggested
                    ? "bg-shake-green/10 border-shake-green/40"
                    : "bg-card border-border/50"
                }`}
                style={{ scrollSnapAlign: "start" }}
              >
                {isSuggested && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-shake-green mb-1 block">
                    ⭐ {t('chat.ourPick', 'Our Pick')}
                  </span>
                )}
                <p className="text-sm font-medium text-foreground truncate">
                  {venue.name}
                </p>
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {venue.address}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSuggestVenue(venue)}
                  className={`w-full h-7 text-xs ${
                    isSuggested
                      ? "bg-shake-green/10 border-shake-green/30 text-shake-green hover:bg-shake-green/20"
                      : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                  }`}
                >
                  {t('chat.suggest', 'Suggest')} 📍
                </Button>
              </div>
            );
          })}
        </div>

        {/* Right scroll button */}
        {cityVenues.length > 2 && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
