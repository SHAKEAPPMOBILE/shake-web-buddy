import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DbVenue {
  id: string;
  city: string;
  name: string;
  address: string;
  venue_type: 'lunch_dinner' | 'brunch' | 'drinks';
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Map activity types to venue types
export function getVenueTypeForActivity(activityType: string): 'lunch_dinner' | 'brunch' | 'drinks' | null {
  if (activityType === 'lunch' || activityType === 'dinner') {
    return 'lunch_dinner';
  }
  if (activityType === 'brunch') {
    return 'brunch';
  }
  if (activityType === 'drinks') {
    return 'drinks';
  }
  return null;
}

// Fetch all venues from database
export function useAllVenues() {
  return useQuery({
    queryKey: ['db-venues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('city', { ascending: true })
        .order('venue_type', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DbVenue[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

// Fetch venues for a specific city
export function useVenuesByCity(city: string) {
  return useQuery({
    queryKey: ['db-venues', city],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('city', city)
        .eq('is_active', true)
        .order('venue_type', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DbVenue[];
    },
    enabled: !!city,
    staleTime: 1000 * 60 * 5,
  });
}

// Get weekly rotating venue from a list of venues
export function getWeeklyVenueFromList(venues: DbVenue[]): DbVenue | null {
  if (!venues || venues.length === 0) return null;
  
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekOfYear = Math.floor(diff / oneWeek);
  
  return venues[weekOfYear % venues.length];
}

// Get daily rotating venue from a list (for bars/drinks)
export function getDailyVenueFromList(venues: DbVenue[]): DbVenue | null {
  if (!venues || venues.length === 0) return null;
  
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  return venues[dayOfYear % venues.length];
}

// Get the current venue for an activity type in a city
export function getCurrentVenueForActivity(
  venues: DbVenue[], 
  city: string, 
  activityType: string
): DbVenue | null {
  const venueType = getVenueTypeForActivity(activityType);
  if (!venueType) return null;
  
  // Filter venues by city and type
  const matchingVenues = venues.filter(
    v => v.city === city && v.venue_type === venueType
  );
  
  if (matchingVenues.length === 0) return null;
  
  // For drinks, rotate daily; for others, rotate weekly
  if (activityType === 'drinks') {
    return getDailyVenueFromList(matchingVenues);
  }
  
  return getWeeklyVenueFromList(matchingVenues);
}

// Get location string for display
export function getVenueLocationString(venue: DbVenue | null, activityType?: string): string {
  if (!venue) {
    return "TBD - Vote in chat!";
  }
  
  // For brunch, include a shorter format
  if (activityType === 'brunch') {
    return `${venue.name}, ${venue.address}`;
  }
  
  return `${venue.name}, ${venue.address}`;
}

// Get Google Maps URL for a venue
export function getVenueMapsUrlFromDb(venue: DbVenue | null): string | null {
  if (!venue) return null;
  
  // If coordinates exist, use them for more accurate location
  if (venue.latitude && venue.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`;
  }
  
  // Fallback to name + address search
  const query = encodeURIComponent(`${venue.name}, ${venue.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
