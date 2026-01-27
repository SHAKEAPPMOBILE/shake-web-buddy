import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface VenueInsert {
  city: string;
  name: string;
  address: string;
  venue_type: 'lunch_dinner' | 'brunch' | 'drinks';
  latitude?: number | null;
  longitude?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('city', { ascending: true })
        .order('venue_type', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DbVenue[];
    },
  });
}

export function useVenuesByCity(city: string) {
  return useQuery({
    queryKey: ['venues', city],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('city', city)
        .order('venue_type', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DbVenue[];
    },
    enabled: !!city,
  });
}

export function useAddVenue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (venue: VenueInsert) => {
      const { data, error } = await supabase
        .from('venues')
        .insert(venue)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbVenue> & { id: string }) => {
      const { data, error } = await supabase
        .from('venues')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useDeleteVenue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

// Helper to get weekly venue from database venues
export function getWeeklyVenueFromList(venues: DbVenue[]): DbVenue | null {
  if (!venues || venues.length === 0) return null;
  
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  return venues[weekOfYear % venues.length];
}

// Helper to get daily venue (for bars/drinks)
export function getDailyVenueFromList(venues: DbVenue[]): DbVenue | null {
  if (!venues || venues.length === 0) return null;
  
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  return venues[dayOfYear % venues.length];
}
