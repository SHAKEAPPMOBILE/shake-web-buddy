export interface City {
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
}

export const SHAKE_CITIES: City[] = [
  // North America
  { name: "New York City", country: "USA", region: "North America", lat: 40.7128, lng: -74.0060 },
  { name: "Los Angeles", country: "USA", region: "North America", lat: 34.0522, lng: -118.2437 },
  { name: "San Francisco", country: "USA", region: "North America", lat: 37.7749, lng: -122.4194 },
  { name: "Miami", country: "USA", region: "North America", lat: 25.7617, lng: -80.1918 },
  { name: "Chicago", country: "USA", region: "North America", lat: 41.8781, lng: -87.6298 },
  { name: "Austin", country: "USA", region: "North America", lat: 30.2672, lng: -97.7431 },
  { name: "Boston", country: "USA", region: "North America", lat: 42.3601, lng: -71.0589 },
  { name: "Seattle", country: "USA", region: "North America", lat: 47.6062, lng: -122.3321 },
  { name: "Dallas", country: "USA", region: "North America", lat: 32.7767, lng: -96.7970 },
  { name: "Washington D.C.", country: "USA", region: "North America", lat: 38.9072, lng: -77.0369 },
  { name: "Toronto", country: "Canada", region: "North America", lat: 43.6532, lng: -79.3832 },
  { name: "Vancouver", country: "Canada", region: "North America", lat: 49.2827, lng: -123.1207 },
  { name: "Montreal", country: "Canada", region: "North America", lat: 45.5017, lng: -73.5673 },
  { name: "Mexico City", country: "Mexico", region: "North America", lat: 19.4326, lng: -99.1332 },
  { name: "Guadalajara", country: "Mexico", region: "North America", lat: 20.6597, lng: -103.3496 },
  
  // Central & South America
  { name: "Bogotá", country: "Colombia", region: "South America", lat: 4.7110, lng: -74.0721 },
  { name: "Medellín", country: "Colombia", region: "South America", lat: 6.2442, lng: -75.5812 },
  { name: "Cartagena", country: "Colombia", region: "South America", lat: 10.3910, lng: -75.4794 },
  { name: "Quito", country: "Ecuador", region: "South America", lat: -0.1807, lng: -78.4678 },
  { name: "Lima", country: "Peru", region: "South America", lat: -12.0464, lng: -77.0428 },
  { name: "Santiago", country: "Chile", region: "South America", lat: -33.4489, lng: -70.6693 },
  { name: "Valparaíso", country: "Chile", region: "South America", lat: -33.0472, lng: -71.6127 },
  { name: "Buenos Aires", country: "Argentina", region: "South America", lat: -34.6037, lng: -58.3816 },
  { name: "Córdoba", country: "Argentina", region: "South America", lat: -31.4201, lng: -64.1888 },
  { name: "Montevideo", country: "Uruguay", region: "South America", lat: -34.9011, lng: -56.1645 },
  { name: "São Paulo", country: "Brazil", region: "South America", lat: -23.5505, lng: -46.6333 },
  { name: "Rio de Janeiro", country: "Brazil", region: "South America", lat: -22.9068, lng: -43.1729 },
  { name: "Brasília", country: "Brazil", region: "South America", lat: -15.7975, lng: -47.8919 },
  { name: "Salvador", country: "Brazil", region: "South America", lat: -12.9714, lng: -38.5014 },
  { name: "Panama City", country: "Panama", region: "South America", lat: 8.9824, lng: -79.5199 },
  
  // Europe – Western & Northern
  { name: "London", country: "United Kingdom", region: "Europe", lat: 51.5074, lng: -0.1278 },
  { name: "Manchester", country: "United Kingdom", region: "Europe", lat: 53.4808, lng: -2.2426 },
  { name: "Dublin", country: "Ireland", region: "Europe", lat: 53.3498, lng: -6.2603 },
  { name: "Paris", country: "France", region: "Europe", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon", country: "France", region: "Europe", lat: 45.7640, lng: 4.8357 },
  { name: "Amsterdam", country: "Netherlands", region: "Europe", lat: 52.3676, lng: 4.9041 },
  { name: "Brussels", country: "Belgium", region: "Europe", lat: 50.8503, lng: 4.3517 },
  { name: "Zurich", country: "Switzerland", region: "Europe", lat: 47.3769, lng: 8.5417 },
  { name: "Geneva", country: "Switzerland", region: "Europe", lat: 46.2044, lng: 6.1432 },
  { name: "Berlin", country: "Germany", region: "Europe", lat: 52.5200, lng: 13.4050 },
  { name: "Munich", country: "Germany", region: "Europe", lat: 48.1351, lng: 11.5820 },
  { name: "Hamburg", country: "Germany", region: "Europe", lat: 53.5511, lng: 9.9937 },
  { name: "Vienna", country: "Austria", region: "Europe", lat: 48.2082, lng: 16.3738 },
  { name: "Stockholm", country: "Sweden", region: "Europe", lat: 59.3293, lng: 18.0686 },
  { name: "Copenhagen", country: "Denmark", region: "Europe", lat: 55.6761, lng: 12.5683 },
  { name: "Oslo", country: "Norway", region: "Europe", lat: 59.9139, lng: 10.7522 },
  { name: "Helsinki", country: "Finland", region: "Europe", lat: 60.1699, lng: 24.9384 },
  { name: "Reykjavik", country: "Iceland", region: "Europe", lat: 64.1466, lng: -21.9426 },
  
  // Europe – Southern & Eastern
  { name: "Madrid", country: "Spain", region: "Europe", lat: 40.4168, lng: -3.7038 },
  { name: "Barcelona", country: "Spain", region: "Europe", lat: 41.3851, lng: 2.1734 },
  { name: "Lisbon", country: "Portugal", region: "Europe", lat: 38.7223, lng: -9.1393 },
  { name: "Porto", country: "Portugal", region: "Europe", lat: 41.1579, lng: -8.6291 },
  { name: "Rome", country: "Italy", region: "Europe", lat: 41.9028, lng: 12.4964 },
  { name: "Milan", country: "Italy", region: "Europe", lat: 45.4642, lng: 9.1900 },
  { name: "Florence", country: "Italy", region: "Europe", lat: 43.7696, lng: 11.2558 },
  { name: "Athens", country: "Greece", region: "Europe", lat: 37.9838, lng: 23.7275 },
  { name: "Budapest", country: "Hungary", region: "Europe", lat: 47.4979, lng: 19.0402 },
  { name: "Prague", country: "Czech Republic", region: "Europe", lat: 50.0755, lng: 14.4378 },
  { name: "Warsaw", country: "Poland", region: "Europe", lat: 52.2297, lng: 21.0122 },
  { name: "Krakow", country: "Poland", region: "Europe", lat: 50.0647, lng: 19.9450 },
  { name: "Bucharest", country: "Romania", region: "Europe", lat: 44.4268, lng: 26.1025 },
  { name: "Belgrade", country: "Serbia", region: "Europe", lat: 44.7866, lng: 20.4489 },
  { name: "Dubrovnik", country: "Croatia", region: "Europe", lat: 42.6507, lng: 18.0944 },
  { name: "Istanbul", country: "Turkey", region: "Europe", lat: 41.0082, lng: 28.9784 },
  
  // Middle East & North Africa
  { name: "Tel Aviv", country: "Israel", region: "Middle East", lat: 32.0853, lng: 34.7818 },
  { name: "Jerusalem", country: "Israel", region: "Middle East", lat: 31.7683, lng: 35.2137 },
  { name: "Dubai", country: "United Arab Emirates", region: "Middle East", lat: 25.2048, lng: 55.2708 },
  { name: "Abu Dhabi", country: "United Arab Emirates", region: "Middle East", lat: 24.4539, lng: 54.3773 },
  { name: "Doha", country: "Qatar", region: "Middle East", lat: 25.2854, lng: 51.5310 },
  { name: "Muscat", country: "Oman", region: "Middle East", lat: 23.5880, lng: 58.3829 },
  { name: "Cairo", country: "Egypt", region: "Middle East", lat: 30.0444, lng: 31.2357 },
  { name: "Marrakech", country: "Morocco", region: "Middle East", lat: 31.6295, lng: -7.9811 },
  { name: "Casablanca", country: "Morocco", region: "Middle East", lat: 33.5731, lng: -7.5898 },
  { name: "Tunis", country: "Tunisia", region: "Middle East", lat: 36.8065, lng: 10.1815 },
  
  // Asia – South & Southeast
  { name: "Mumbai", country: "India", region: "Asia", lat: 19.0760, lng: 72.8777 },
  { name: "New Delhi", country: "India", region: "Asia", lat: 28.6139, lng: 77.2090 },
  { name: "Bangalore", country: "India", region: "Asia", lat: 12.9716, lng: 77.5946 },
  { name: "Chennai", country: "India", region: "Asia", lat: 13.0827, lng: 80.2707 },
  { name: "Colombo", country: "Sri Lanka", region: "Asia", lat: 6.9271, lng: 79.8612 },
  { name: "Dhaka", country: "Bangladesh", region: "Asia", lat: 23.8103, lng: 90.4125 },
  { name: "Bangkok", country: "Thailand", region: "Asia", lat: 13.7563, lng: 100.5018 },
  { name: "Chiang Mai", country: "Thailand", region: "Asia", lat: 18.7883, lng: 98.9853 },
  { name: "Singapore", country: "Singapore", region: "Asia", lat: 1.3521, lng: 103.8198 },
  { name: "Kuala Lumpur", country: "Malaysia", region: "Asia", lat: 3.1390, lng: 101.6869 },
  { name: "Hanoi", country: "Vietnam", region: "Asia", lat: 21.0278, lng: 105.8342 },
  { name: "Ho Chi Minh City", country: "Vietnam", region: "Asia", lat: 10.8231, lng: 106.6297 },
  { name: "Manila", country: "Philippines", region: "Asia", lat: 14.5995, lng: 120.9842 },
  { name: "Jakarta", country: "Indonesia", region: "Asia", lat: -6.2088, lng: 106.8456 },
  { name: "Bali", country: "Indonesia", region: "Asia", lat: -8.3405, lng: 115.0920 },
  
  // Asia – East
  { name: "Tokyo", country: "Japan", region: "Asia", lat: 35.6762, lng: 139.6503 },
  { name: "Osaka", country: "Japan", region: "Asia", lat: 34.6937, lng: 135.5023 },
  { name: "Kyoto", country: "Japan", region: "Asia", lat: 35.0116, lng: 135.7681 },
  { name: "Seoul", country: "South Korea", region: "Asia", lat: 37.5665, lng: 126.9780 },
  { name: "Busan", country: "South Korea", region: "Asia", lat: 35.1796, lng: 129.0756 },
  { name: "Taipei", country: "Taiwan", region: "Asia", lat: 25.0330, lng: 121.5654 },
  { name: "Hong Kong", country: "China", region: "Asia", lat: 22.3193, lng: 114.1694 },
  { name: "Beijing", country: "China", region: "Asia", lat: 39.9042, lng: 116.4074 },
  { name: "Shanghai", country: "China", region: "Asia", lat: 31.2304, lng: 121.4737 },
  
  // Oceania & Africa
  { name: "Sydney", country: "Australia", region: "Oceania", lat: -33.8688, lng: 151.2093 },
  { name: "Cape Town", country: "South Africa", region: "Africa", lat: -33.9249, lng: 18.4241 },
];

// Helper function to calculate distance between two coordinates (Haversine formula)
export function getDistanceFromLatLng(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function findClosestCity(lat: number, lng: number): City {
  let closestCity = SHAKE_CITIES[0];
  let minDistance = Infinity;
  
  for (const city of SHAKE_CITIES) {
    const distance = getDistanceFromLatLng(lat, lng, city.lat, city.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }
  
  return closestCity;
}

export const REGIONS = [...new Set(SHAKE_CITIES.map(city => city.region))];