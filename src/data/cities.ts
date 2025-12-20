export interface City {
  name: string;
  country: string;
  region: string;
}

export const SHAKE_CITIES: City[] = [
  // North America
  { name: "New York City", country: "USA", region: "North America" },
  { name: "Los Angeles", country: "USA", region: "North America" },
  { name: "San Francisco", country: "USA", region: "North America" },
  { name: "Miami", country: "USA", region: "North America" },
  { name: "Chicago", country: "USA", region: "North America" },
  { name: "Austin", country: "USA", region: "North America" },
  { name: "Boston", country: "USA", region: "North America" },
  { name: "Seattle", country: "USA", region: "North America" },
  { name: "Dallas", country: "USA", region: "North America" },
  { name: "Washington D.C.", country: "USA", region: "North America" },
  { name: "Toronto", country: "Canada", region: "North America" },
  { name: "Vancouver", country: "Canada", region: "North America" },
  { name: "Montreal", country: "Canada", region: "North America" },
  { name: "Mexico City", country: "Mexico", region: "North America" },
  { name: "Guadalajara", country: "Mexico", region: "North America" },
  
  // Central & South America
  { name: "Bogotá", country: "Colombia", region: "South America" },
  { name: "Medellín", country: "Colombia", region: "South America" },
  { name: "Cartagena", country: "Colombia", region: "South America" },
  { name: "Quito", country: "Ecuador", region: "South America" },
  { name: "Lima", country: "Peru", region: "South America" },
  { name: "Santiago", country: "Chile", region: "South America" },
  { name: "Valparaíso", country: "Chile", region: "South America" },
  { name: "Buenos Aires", country: "Argentina", region: "South America" },
  { name: "Córdoba", country: "Argentina", region: "South America" },
  { name: "Montevideo", country: "Uruguay", region: "South America" },
  { name: "São Paulo", country: "Brazil", region: "South America" },
  { name: "Rio de Janeiro", country: "Brazil", region: "South America" },
  { name: "Brasília", country: "Brazil", region: "South America" },
  { name: "Salvador", country: "Brazil", region: "South America" },
  { name: "Panama City", country: "Panama", region: "South America" },
  
  // Europe – Western & Northern
  { name: "London", country: "United Kingdom", region: "Europe" },
  { name: "Manchester", country: "United Kingdom", region: "Europe" },
  { name: "Dublin", country: "Ireland", region: "Europe" },
  { name: "Paris", country: "France", region: "Europe" },
  { name: "Lyon", country: "France", region: "Europe" },
  { name: "Amsterdam", country: "Netherlands", region: "Europe" },
  { name: "Brussels", country: "Belgium", region: "Europe" },
  { name: "Zurich", country: "Switzerland", region: "Europe" },
  { name: "Geneva", country: "Switzerland", region: "Europe" },
  { name: "Berlin", country: "Germany", region: "Europe" },
  { name: "Munich", country: "Germany", region: "Europe" },
  { name: "Hamburg", country: "Germany", region: "Europe" },
  { name: "Vienna", country: "Austria", region: "Europe" },
  { name: "Stockholm", country: "Sweden", region: "Europe" },
  { name: "Copenhagen", country: "Denmark", region: "Europe" },
  { name: "Oslo", country: "Norway", region: "Europe" },
  { name: "Helsinki", country: "Finland", region: "Europe" },
  { name: "Reykjavik", country: "Iceland", region: "Europe" },
  
  // Europe – Southern & Eastern
  { name: "Madrid", country: "Spain", region: "Europe" },
  { name: "Barcelona", country: "Spain", region: "Europe" },
  { name: "Lisbon", country: "Portugal", region: "Europe" },
  { name: "Porto", country: "Portugal", region: "Europe" },
  { name: "Rome", country: "Italy", region: "Europe" },
  { name: "Milan", country: "Italy", region: "Europe" },
  { name: "Florence", country: "Italy", region: "Europe" },
  { name: "Athens", country: "Greece", region: "Europe" },
  { name: "Budapest", country: "Hungary", region: "Europe" },
  { name: "Prague", country: "Czech Republic", region: "Europe" },
  { name: "Warsaw", country: "Poland", region: "Europe" },
  { name: "Krakow", country: "Poland", region: "Europe" },
  { name: "Bucharest", country: "Romania", region: "Europe" },
  { name: "Belgrade", country: "Serbia", region: "Europe" },
  { name: "Dubrovnik", country: "Croatia", region: "Europe" },
  { name: "Istanbul", country: "Turkey", region: "Europe" },
  
  // Middle East & North Africa
  { name: "Tel Aviv", country: "Israel", region: "Middle East" },
  { name: "Jerusalem", country: "Israel", region: "Middle East" },
  { name: "Dubai", country: "United Arab Emirates", region: "Middle East" },
  { name: "Abu Dhabi", country: "United Arab Emirates", region: "Middle East" },
  { name: "Doha", country: "Qatar", region: "Middle East" },
  { name: "Muscat", country: "Oman", region: "Middle East" },
  { name: "Cairo", country: "Egypt", region: "Middle East" },
  { name: "Marrakech", country: "Morocco", region: "Middle East" },
  { name: "Casablanca", country: "Morocco", region: "Middle East" },
  { name: "Tunis", country: "Tunisia", region: "Middle East" },
  
  // Asia – South & Southeast
  { name: "Mumbai", country: "India", region: "Asia" },
  { name: "New Delhi", country: "India", region: "Asia" },
  { name: "Bangalore", country: "India", region: "Asia" },
  { name: "Chennai", country: "India", region: "Asia" },
  { name: "Colombo", country: "Sri Lanka", region: "Asia" },
  { name: "Dhaka", country: "Bangladesh", region: "Asia" },
  { name: "Bangkok", country: "Thailand", region: "Asia" },
  { name: "Chiang Mai", country: "Thailand", region: "Asia" },
  { name: "Singapore", country: "Singapore", region: "Asia" },
  { name: "Kuala Lumpur", country: "Malaysia", region: "Asia" },
  { name: "Hanoi", country: "Vietnam", region: "Asia" },
  { name: "Ho Chi Minh City", country: "Vietnam", region: "Asia" },
  { name: "Manila", country: "Philippines", region: "Asia" },
  { name: "Jakarta", country: "Indonesia", region: "Asia" },
  { name: "Bali", country: "Indonesia", region: "Asia" },
  
  // Asia – East
  { name: "Tokyo", country: "Japan", region: "Asia" },
  { name: "Osaka", country: "Japan", region: "Asia" },
  { name: "Kyoto", country: "Japan", region: "Asia" },
  { name: "Seoul", country: "South Korea", region: "Asia" },
  { name: "Busan", country: "South Korea", region: "Asia" },
  { name: "Taipei", country: "Taiwan", region: "Asia" },
  { name: "Hong Kong", country: "China", region: "Asia" },
  { name: "Beijing", country: "China", region: "Asia" },
  { name: "Shanghai", country: "China", region: "Asia" },
  
  // Oceania & Africa
  { name: "Sydney", country: "Australia", region: "Oceania" },
  { name: "Cape Town", country: "South Africa", region: "Africa" },
];

export const REGIONS = [...new Set(SHAKE_CITIES.map(city => city.region))];
