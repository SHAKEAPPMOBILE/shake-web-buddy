export interface VenuePlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Free, keyless place search via Photon (komoot's geocoding API built on
 * OpenStreetMap data — no billing account required). Shared by
 * VenueSearchInput's live suggestions and voice-to-plan's venue step, so
 * both resolve a spoken/typed place name against the same source.
 */
export async function searchVenuePlaces(
  query: string,
  coords?: { lat: number; lng: number } | null,
  limit = 5
): Promise<VenuePlace[]> {
  if (query.trim().length < 3) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (coords) {
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lng));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Photon geocoding failed: ${res.status}`);
  const data = await res.json();

  return (data.features || [])
    .map((f: any) => {
      const p = f.properties || {};
      const name: string = p.name || p.street || p.city || "";
      const addressParts = [
        p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
        p.city,
        p.state,
        p.country,
      ].filter(Boolean);
      return {
        name,
        address: addressParts.join(", ") || name,
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
      };
    })
    .filter((p: VenuePlace) => p.name && typeof p.lat === "number" && typeof p.lng === "number");
}
