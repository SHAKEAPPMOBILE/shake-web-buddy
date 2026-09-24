export interface LatLng { lat: number; lng: number }

/** Location messages are stored as message_type "location", message "lat,lng". */
export function encodeLocation({ lat, lng }: LatLng): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function parseLocation(message: string | null | undefined): LatLng | null {
  if (!message) return null;
  const [a, b] = message.split(",");
  const lat = Number(a);
  const lng = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function getCurrentLatLng(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not available")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export function mapsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
