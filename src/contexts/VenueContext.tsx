import React, { createContext, useContext, useMemo } from "react";
import { useAllVenues, useVenuesForActivity, DbVenue, getCurrentVenueForActivity, getVenueLocationString, getVenueMapsUrlFromDb, normalizeCity, getVenueTypeForActivity } from "@/hooks/useDatabaseVenues";

interface VenueContextType {
  venues: DbVenue[];
  isLoading: boolean;
  error: Error | null;
  refetchVenues: () => void;
  getVenueForActivity: (city: string, activityType: string) => DbVenue | null;
  getLocationString: (city: string, activityType: string) => string;
  getMapsUrl: (city: string, activityType: string) => string | null;
  getVenueCoordinates: (city: string, venueName: string) => { lat: number; lng: number } | null;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const { data: venues = [], isLoading, error, refetch: refetchVenues } = useAllVenues();

  const getVenueForActivity = useMemo(() => {
    return (city: string, activityType: string): DbVenue | null => {
      return getCurrentVenueForActivity(venues, city, activityType);
    };
  }, [venues]);

  const getLocationString = useMemo(() => {
    return (city: string, activityType: string): string => {
      const venue = getCurrentVenueForActivity(venues, city, activityType);
      return getVenueLocationString(venue, activityType);
    };
  }, [venues]);

  const getMapsUrl = useMemo(() => {
    return (city: string, activityType: string): string | null => {
      const venue = getCurrentVenueForActivity(venues, city, activityType);
      return getVenueMapsUrlFromDb(venue);
    };
  }, [venues]);

  const getVenueCoordinates = useMemo(() => {
    return (city: string, venueName: string): { lat: number; lng: number } | null => {
      const cityNorm = normalizeCity(city);
      const venue = venues.find(v => normalizeCity(v.city) === cityNorm && v.name === venueName);
      if (venue && venue.latitude && venue.longitude) {
        return { lat: venue.latitude, lng: venue.longitude };
      }
      return null;
    };
  }, [venues]);

  const value: VenueContextType = {
    venues,
    isLoading,
    error: error as Error | null,
    refetchVenues,
    getVenueForActivity,
    getLocationString,
    getMapsUrl,
    getVenueCoordinates,
  };

  return (
    <VenueContext.Provider value={value}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenueContext() {
  const context = useContext(VenueContext);
  if (context === undefined) {
    throw new Error("useVenueContext must be used within a VenueProvider");
  }
  return context;
}

// Convenience hook for getting activity location details
export function useActivityVenue(city: string, activityType: string) {
  const { getVenueForActivity, isLoading, error: venueError, refetchVenues } = useVenueContext();
  const mappedVenueType = getVenueTypeForActivity(activityType);
  const {
    data: queriedVenues = [],
    isLoading: queryLoading,
    error: queryError,
    refetch: refetchQueriedVenues,
  } = useVenuesForActivity(city, activityType);

  const fallbackVenue = getVenueForActivity(city, activityType);
  const queriedVenue = useMemo(
    () => getCurrentVenueForActivity(queriedVenues, city, activityType),
    [queriedVenues, city, activityType]
  );
  const venue = queriedVenue ?? fallbackVenue;
  const location = getVenueLocationString(venue, activityType);
  const mapsUrl = getVenueMapsUrlFromDb(venue);

  console.log('[VenueDebug] query path:', {
    supabaseTable: 'venues',
    supabaseSelect: '*',
    supabaseOrderBy: ['sort_order ASC'],
    serverFilters: city && mappedVenueType
      ? {
          city,
          venue_type: mappedVenueType,
          is_active: true,
        }
      : {
          skipped: true,
          city: city || '(missing)',
          venue_type: mappedVenueType || '(missing)',
        },
    clientFilters: {
      city: city,
      normalizedCity: normalizeCity(city),
      activityType,
      mappedVenueType,
      venueSelection: 'weekly for lunch/dinner/brunch, daily for drinks',
    },
  });
  
  return {
    venue,
    location,
    mapsUrl,
    isLoading: isLoading || queryLoading,
    venueError: ((queryError as Error | null) ?? (venueError as Error | null)) as Error | null,
    refetchVenues: () => {
      void refetchQueriedVenues();
      void refetchVenues();
    },
    isTBD: !(isLoading || queryLoading) && location === "TBD - Vote in chat!",
    venueName: venue?.name || null,
  };
}
