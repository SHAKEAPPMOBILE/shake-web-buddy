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
  is_starred?: boolean | null;
  instagram_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Normalize city for matching (case-insensitive, trim, accent folding) - exported for use in VenueContext
export function normalizeCity(city: string): string {
  const trimmed = (city || "").trim();
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Strip common geographic suffixes so "Austin, TX" and "Austin" match
const CITY_SUFFIX_RE = /,\s*(tx|ny|ca|fl|il|wa|co|ma|ga|or|az|nv|nc|oh|mi|pa|va|tn|mo|mn|wi|ia|ok|ks|ar|ms|al|sc|ky|in|la|md|de|ut|id|mt|wy|nd|sd|ne|nm|wv|ri|ct|nh|me|vt|ak|hi|dc|city|nyc)\s*$/i;

export function stripCitySuffix(city: string): string {
  return city.replace(CITY_SUFFIX_RE, "").trim();
}

// Fuzzy city matching: exact → suffix-stripped exact → partial containment
export function citiesMatch(a: string, b: string): boolean {
  const aNorm = normalizeCity(a);
  const bNorm = normalizeCity(b);

  // 1. Exact normalized match
  if (aNorm === bNorm) return true;

  // 2. Match after stripping geographic suffixes
  const aStripped = normalizeCity(stripCitySuffix(a));
  const bStripped = normalizeCity(stripCitySuffix(b));
  if (aStripped && bStripped && aStripped === bStripped) return true;

  // 3. Partial containment (one is a substring of the other, at least 3 chars)
  if (aStripped.length >= 3 && bStripped.length >= 3) {
    if (aStripped.includes(bStripped) || bStripped.includes(aStripped)) return true;
  }

  return false;
}

// Map activity types to venue types
export function getVenueTypeForActivity(activityType: string): 'lunch_dinner' | 'brunch' | 'drinks' | null {
  const normalizedActivityType = (activityType || '').trim().toLowerCase();

  if (normalizedActivityType === 'lunch' || normalizedActivityType === 'dinner') {
    return 'lunch_dinner';
  }
  if (normalizedActivityType === 'brunch') {
    return 'brunch';
  }
  if (normalizedActivityType === 'drinks') {
    return 'drinks';
  }
  return null;
}

// Fetch all venues from database (used by app for join confirmation and group chat).
// Same query shape as admin (useVenues): no server-side is_active filter, then filter in JS.
// This avoids RLS/query differences between admin and app.
export function useAllVenues() {
  return useQuery({
    queryKey: ['db-venues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('city', { ascending: true })
        .order('venue_type', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }) // stable tiebreaker for equal sort_order, so rotation order doesn't shuffle between fetches
        .limit(5000); // Prevent PostgREST default max_rows (1000) from silently truncating
      
      if (error) {
        console.warn('[Venues] Failed to load from Supabase:', error.message, error.code, error);
        throw error;
      }
      const list = (data ?? []) as DbVenue[];
      const active = list.filter((v) => v.is_active !== false);
      return active;
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
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as DbVenue[];
    },
    enabled: !!city,
    staleTime: 1000 * 60 * 5,
  });
}

export function useVenuesForActivity(city: string, activityType: string) {
  const normalizedCity = (city || '').trim();
  const venueType = getVenueTypeForActivity(activityType);

  return useQuery({
    queryKey: ['db-venues', 'activity', normalizedCity, venueType],
    queryFn: async () => {
      if (!normalizedCity || !venueType) {
        return [] as DbVenue[];
      }

      // Fetch all active venues for this venue_type (no city filter server-side)
      // then apply fuzzy city matching client-side to handle "Austin" vs "Austin, TX" etc.
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('venue_type', venueType)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      const allRows = (data ?? []) as DbVenue[];

      // Fuzzy city filter
      const rows = allRows.filter(v => citiesMatch(v.city, normalizedCity));
      return rows;
    },
    enabled: !!normalizedCity && !!venueType,
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
  
  const cityNorm = normalizeCity(city);
  if (!cityNorm) return null;

  // Filter venues by city (fuzzy: exact → suffix-stripped → partial) and type
  const matchingVenues = venues.filter(v => {
    if (v.venue_type !== venueType) return false;
    const match = citiesMatch(v.city, city);
    return match;
  });

  if (matchingVenues.length === 0) {
    return null;
  }

  // Starred venue always wins over rotation
  const starred = matchingVenues.find(v => v.is_starred === true);
  if (starred) return starred;

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
