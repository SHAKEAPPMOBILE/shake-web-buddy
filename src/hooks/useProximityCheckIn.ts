import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVenueContext } from "@/contexts/VenueContext";
import { getDistanceFromLatLng } from "@/data/cities";

const PROXIMITY_THRESHOLD_METERS = 100; // Show pop-up within 100m of venue
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

interface ProximityState {
  isNearVenue: boolean;
  venueName: string | null;
  city: string | null;
  activityType: string | null;
  distance: number | null;
}

export function useProximityCheckIn(currentCity: string, activeActivityTypes: string[]) {
  const { user } = useAuth();
  const { getVenueForActivity, getVenueCoordinates } = useVenueContext();
  const [proximityState, setProximityState] = useState<ProximityState>({
    isNearVenue: false,
    venueName: null,
    city: null,
    activityType: null,
    distance: null,
  });
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);

  const checkProximity = useCallback(async () => {
    if (!user || !currentCity || activeActivityTypes.length === 0) {
      setProximityState({
        isNearVenue: false,
        venueName: null,
        city: null,
        activityType: null,
        distance: null,
      });
      return;
    }

    if (!("geolocation" in navigator)) return;

    setIsCheckingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Check each active activity type for proximity
      for (const activityType of activeActivityTypes) {
        // Map activity types to venue types
        let venueType = activityType;
        if (activityType === "lunch" || activityType === "dinner") {
          venueType = "lunch_dinner";
        }

        const venue = getVenueForActivity(currentCity, venueType);
        if (!venue) continue;

        const venueCoords = getVenueCoordinates(currentCity, venue.name);
        if (!venueCoords) continue;

        const distanceKm = getDistanceFromLatLng(userLat, userLng, venueCoords.lat, venueCoords.lng);
        const distanceMeters = distanceKm * 1000;

        if (distanceMeters <= PROXIMITY_THRESHOLD_METERS) {
          setProximityState({
            isNearVenue: true,
            venueName: venue.name,
            city: currentCity,
            activityType: activityType,
            distance: Math.round(distanceMeters),
          });
          setIsCheckingLocation(false);
          return;
        }
      }

      // Not near any venue
      setProximityState({
        isNearVenue: false,
        venueName: null,
        city: null,
        activityType: null,
        distance: null,
      });
    } catch (error) {
      // Silently fail - user may have denied location
      console.log("Proximity check failed:", error);
    } finally {
      setIsCheckingLocation(false);
    }
  }, [user, currentCity, activeActivityTypes, getVenueCoordinates, getVenueForActivity]);

  // Check proximity on mount and periodically
  useEffect(() => {
    if (!user || activeActivityTypes.length === 0) return;

    // Initial check
    checkProximity();

    // Periodic checks
    const interval = setInterval(checkProximity, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkProximity, user, activeActivityTypes]);

  const dismissProximity = useCallback(() => {
    setProximityState({
      isNearVenue: false,
      venueName: null,
      city: null,
      activityType: null,
      distance: null,
    });
  }, []);

  return {
    ...proximityState,
    isCheckingLocation,
    checkProximity,
    dismissProximity,
  };
}
