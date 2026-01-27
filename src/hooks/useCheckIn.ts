import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { getDistanceFromLatLng, SHAKE_CITIES } from "@/data/cities";
import { useVenueContext } from "@/contexts/VenueContext";

const POINTS_PER_CHECKIN = 5;
const MAX_DISTANCE_METERS = 50; // Maximum distance in meters to allow check-in (50m from venue)

interface GeolocationResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

async function getCurrentPosition(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ success: false, error: "Geolocation not supported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = "Unable to get your location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access to check in.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        resolve({ success: false, error: errorMessage });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}

// Fallback to city center if venue coordinates not found
function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const city = SHAKE_CITIES.find((c) => c.name === cityName);
  return city ? { lat: city.lat, lng: city.lng } : null;
}

export function useCheckIn() {
  const { user } = useAuth();
  const { getVenueCoordinates } = useVenueContext();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<Record<string, boolean>>({});

  const checkIfAlreadyCheckedIn = useCallback(async (activityType: string, city: string) => {
    if (!user) return false;
    
    const key = `${activityType}-${city}`;
    if (hasCheckedInToday[key] !== undefined) {
      return hasCheckedInToday[key];
    }

    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("activity_type", activityType)
      .eq("city", city)
      .eq("check_in_date", today)
      .maybeSingle();

    if (error) {
      console.error("Error checking check-in status:", error);
      return false;
    }

    const alreadyCheckedIn = !!data;
    setHasCheckedInToday(prev => ({ ...prev, [key]: alreadyCheckedIn }));
    return alreadyCheckedIn;
  }, [user, hasCheckedInToday]);

  const checkIn = useCallback(async (
    activityType: string,
    city: string,
    venueName: string
  ): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to check in");
      return false;
    }

    setIsCheckingIn(true);

    try {
      // Step 1: Get user's current location
      const locationResult = await getCurrentPosition();
      
      if (!locationResult.success) {
        toast.error(locationResult.error || "Unable to verify your location");
        return false;
      }

      // Step 2: Get venue coordinates from database (try specific venue first, fallback to city center)
      let venueCoords = getVenueCoordinates(city, venueName);
      let usingCityFallback = false;
      
      if (!venueCoords) {
        // Fallback to city center with larger radius if venue coords not found
        const cityCoords = getCityCoordinates(city);
        if (!cityCoords) {
          toast.error("Unable to verify venue location");
          return false;
        }
        venueCoords = cityCoords;
        usingCityFallback = true;
      }

      // Step 3: Calculate distance between user and venue
      const distanceKm = getDistanceFromLatLng(
        locationResult.latitude!,
        locationResult.longitude!,
        venueCoords.lat,
        venueCoords.lng
      );
      const distanceMeters = distanceKm * 1000;
      
      // Use larger radius for city fallback, strict 50m for known venues
      const maxDistance = usingCityFallback ? 500 : MAX_DISTANCE_METERS;

      // Step 4: Validate proximity
      if (distanceMeters > maxDistance) {
        const distanceDisplay = distanceKm >= 1 
          ? `${distanceKm.toFixed(1)} km` 
          : `${Math.round(distanceMeters)} meters`;
        toast.error(`You're ${distanceDisplay} away from ${venueName}`, {
          description: `You need to be within ${maxDistance}m to check in`,
        });
        return false;
      }

      // Step 5: Proceed with check-in
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from("check_ins")
        .insert({
          user_id: user.id,
          activity_type: activityType,
          city: city,
          venue_name: venueName,
          points_earned: POINTS_PER_CHECKIN,
          check_in_date: today,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.info("You've already checked in here today!");
          const key = `${activityType}-${city}`;
          setHasCheckedInToday(prev => ({ ...prev, [key]: true }));
          return false;
        }
        throw error;
      }

      const key = `${activityType}-${city}`;
      setHasCheckedInToday(prev => ({ ...prev, [key]: true }));
      
      toast.success(`+${POINTS_PER_CHECKIN} points! 🎉`, {
        description: `Checked in at ${venueName}`,
      });
      triggerConfettiWaterfall();
      
      return true;
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in. Please try again.");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  }, [user]);

  return {
    checkIn,
    isCheckingIn,
    checkIfAlreadyCheckedIn,
    hasCheckedInToday,
  };
}
