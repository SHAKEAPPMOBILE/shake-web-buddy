// Venue data for lunch and dinner activities
// For drinks and hike, we keep "TBD - Vote in chat!"

export interface Venue {
  name: string;
  address: string;
}

// Map city names to their venues (for lunch/dinner)
export const CITY_VENUES: Record<string, Venue> = {
  // Portugal
  "Lisbon": {
    name: "Honest Greens",
    address: "Avenida da Liberdade, 180 B"
  },
  "Porto": {
    name: "Honest Greens Porto - Boavista",
    address: "Avenida da Boavista, 3431"
  },
  
  // Spain
  "Madrid": {
    name: "Honest Greens Castellana",
    address: "Paseo de la Castellana, 89"
  },
  "Barcelona": {
    name: "Honest Greens Rambla Catalunya",
    address: "Rambla de Catalunya, 3"
  },
  
  // Italy
  "Rome": {
    name: "Ginger Sapori e Salute",
    address: "Via Borgognona, 43-46"
  },
  "Milan": {
    name: "That's Vapore",
    address: "Piazza Gae Aulenti, 20154 Milano"
  },
  "Florence": {
    name: "Shake Café",
    address: "Via Camilo Cavour, 67/69R, 50121 Firenze"
  },
  
  // France
  "Paris": {
    name: "Wild & The Moon",
    address: "55 Rue Charlot, 75003 Paris"
  },
  "Lyon": {
    name: "Le Kitchen Café",
    address: "36 Rue de la Charité, 69002 Lyon"
  },
  
  // Germany
  "Berlin": {
    name: "The Green Market",
    address: "Rosenthaler Str. 39, 10178 Berlin"
  },
  "Munich": {
    name: "OhJulia (Marienplatz)",
    address: "Sendlinger Str. 12, 80331 München"
  },
  "Hamburg": {
    name: "Dean & David",
    address: "Mönckebergstraße 11, 20095 Hamburg"
  },
  
  // United Kingdom
  "London": {
    name: "Farmacy",
    address: "74-76 Portobello Rd, W11 2QB"
  },
  "Manchester": {
    name: "Evelyn's Café Bar",
    address: "Manchester"
  },
  "Birmingham": {
    name: "Natural Bar & Kitchen",
    address: "24 Suffolk Street, Queensway, B1 1LT"
  },
  "Edinburgh": {
    name: "Hula Juice Bar & Café",
    address: "103-105 West Bow, Edinburgh EH1 2JP"
  },
  
  // Ireland
  "Dublin": {
    name: "Brother Hubbard (North)",
    address: "153 Capel St, Dublin 1"
  },
  "Cork": {
    name: "Paradiso",
    address: "16 Lancaster Quay, Cork"
  },
  
  // Switzerland
  "Zurich": {
    name: "Beetnut",
    address: "Sihlstrasse 37, 8001 Zürich"
  },
  "Geneva": {
    name: "Birdie Food & Coffee",
    address: "Rue des Bains 40, 1205 Geneva"
  },
  "Basel": {
    name: "La Manufacture",
    address: "Falknerstrasse 12, 4051 Basel"
  },
  
  // Austria
  "Vienna": {
    name: "Karma Food",
    address: "Vienna"
  },
  "Innsbruck": {
    name: "Ludwig Das Burger Restaurant",
    address: "Innsbruck"
  },
  
  // Poland
  "Warsaw": {
    name: "Tel Aviv Urban Food",
    address: "Warsaw"
  },
  
  // USA
  "New York": {
    name: "Sweetgreen Broadway",
    address: "New York, NY"
  },
  "San Francisco": {
    name: "Souvla",
    address: "San Francisco, CA"
  },
  "Los Angeles": {
    name: "The Butcher's Daughter",
    address: "Los Angeles, CA"
  },
  "San Diego": {
    name: "Sweetgreen",
    address: "4309 La Jolla Village Dr Suite 2040, San Diego, CA 92122"
  },
  "Austin": {
    name: "Sweetgreen Downtown",
    address: "Austin, TX"
  },
};

/**
 * Get the venue location string for an activity
 * For lunch and dinner: returns venue name and address if available
 * For drinks and hike: returns "TBD - Vote in chat!"
 */
export function getActivityLocation(activityType: string, city: string): string {
  // Only lunch and dinner have pre-set venues
  if (activityType === "lunch" || activityType === "dinner") {
    const venue = CITY_VENUES[city];
    if (venue) {
      return `${venue.name}, ${venue.address}`;
    }
    // Fallback if city not in list
    return "TBD - Vote in chat!";
  }
  
  // Drinks and hike always show vote message
  return "TBD - Vote in chat!";
}
