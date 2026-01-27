import React, { createContext, useContext, useMemo } from "react";
import { useAllVenues, DbVenue, getCurrentVenueForActivity, getVenueLocationString, getVenueMapsUrlFromDb } from "@/hooks/useDatabaseVenues";

interface VenueContextType {
  venues: DbVenue[];
  isLoading: boolean;
  error: Error | null;
  getVenueForActivity: (city: string, activityType: string) => DbVenue | null;
  getLocationString: (city: string, activityType: string) => string;
  getMapsUrl: (city: string, activityType: string) => string | null;
  getVenueCoordinates: (city: string, venueName: string) => { lat: number; lng: number } | null;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const { data: venues = [], isLoading, error } = useAllVenues();

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
      const venue = venues.find(v => v.city === city && v.name === venueName);
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
  const { getVenueForActivity, getLocationString, getMapsUrl } = useVenueContext();
  
  const venue = getVenueForActivity(city, activityType);
  const location = getLocationString(city, activityType);
  const mapsUrl = getMapsUrl(city, activityType);
  
  return {
    venue,
    location,
    mapsUrl,
    isTBD: location === "TBD - Vote in chat!",
    venueName: venue?.name || null,
  };
}
