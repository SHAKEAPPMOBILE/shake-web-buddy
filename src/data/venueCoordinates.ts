// GPS coordinates for venue check-ins (50m radius validation)
// Coordinates are approximate based on venue addresses

export interface VenueCoordinates {
  lat: number;
  lng: number;
}

// Venue coordinates by city -> venue name
export const VENUE_COORDINATES: Record<string, Record<string, VenueCoordinates>> = {
  // ========== PORTUGAL ==========
  "Lisbon": {
    "Honest Greens": { lat: 38.7197, lng: -9.1465 },
    "Pensão Amor": { lat: 38.7094, lng: -9.1436 },
    "Toca da Raposa": { lat: 38.7100, lng: -9.1422 },
    "Imprensa Cocktail & Oyster Bar": { lat: 38.7142, lng: -9.1501 },
    "Park Rooftop Bar": { lat: 38.7126, lng: -9.1479 },
    "IF IF IF": { lat: 38.7201, lng: -9.1508 },
    "Amélia Café": { lat: 38.7130, lng: -9.1400 },
    "Heim Café": { lat: 38.7145, lng: -9.1420 },
    "Copenhagen Coffee Lab": { lat: 38.7160, lng: -9.1450 },
  },
  "Porto": {
    "Honest Greens Porto - Boavista": { lat: 41.1580, lng: -8.6300 },
    "The Royal Cocktail Club": { lat: 41.1456, lng: -8.6109 },
    "Base Porto": { lat: 41.1458, lng: -8.6143 },
    "Bonaparte Downtown": { lat: 41.1445, lng: -8.6130 },
    "Seagull Method Café": { lat: 41.1470, lng: -8.6150 },
    "Zenith Brunch & Cocktails": { lat: 41.1490, lng: -8.6140 },
    "O Diplomata": { lat: 41.1480, lng: -8.6120 },
  },
  
  // ========== SPAIN ==========
  "Madrid": {
    "Honest Greens Castellana": { lat: 40.4527, lng: -3.6915 },
    "Salmon Guru": { lat: 40.4136, lng: -3.7068 },
    "1862 Dry Bar": { lat: 40.4243, lng: -3.7044 },
    "Angelita Madrid": { lat: 40.4255, lng: -3.7035 },
    "La Venencia": { lat: 40.4161, lng: -3.6982 },
    "Brunch & Cake": { lat: 40.4230, lng: -3.6900 },
    "Federal Café": { lat: 40.4210, lng: -3.6950 },
    "Flax & Kale": { lat: 40.4290, lng: -3.7010 },
  },
  "Barcelona": {
    "Honest Greens Rambla Catalunya": { lat: 41.3884, lng: 2.1652 },
    "Las Vermudas": { lat: 41.4020, lng: 2.1576 },
    "Elephanta Gin Bar": { lat: 41.4000, lng: 2.1560 },
    "Paradiso": { lat: 41.3838, lng: 2.1813 },
    "Dry Martini Bar": { lat: 41.3927, lng: 2.1553 },
    "Brunch & Cake": { lat: 41.3950, lng: 2.1650 },
    "Federal Café": { lat: 41.3890, lng: 2.1680 },
    "Flax & Kale": { lat: 41.3920, lng: 2.1700 },
  },
  
  // ========== ITALY ==========
  "Rome": {
    "Ginger Sapori e Salute": { lat: 41.9057, lng: 12.4797 },
    "Jerry Thomas Project": { lat: 41.8970, lng: 12.4700 },
    "Freni e Fricioni": { lat: 41.8880, lng: 12.4680 },
    "Drink Kong": { lat: 41.8950, lng: 12.4720 },
    "Bar San Calisto": { lat: 41.8870, lng: 12.4694 },
    "Barnum Café": { lat: 41.9030, lng: 12.4780 },
    "Coromandel": { lat: 41.9010, lng: 12.4750 },
  },
  "Milan": {
    "That's Vapore": { lat: 45.4842, lng: 9.1882 },
    "Nottingham Forest": { lat: 45.4660, lng: 9.1900 },
    "Camparino en Galleria": { lat: 45.4657, lng: 9.1899 },
    "Mag Café": { lat: 45.4500, lng: 9.1790 },
    "Terrazza Aperol": { lat: 45.4660, lng: 9.1890 },
    "Bar Basso": { lat: 45.4750, lng: 9.2050 },
    "Pavé": { lat: 45.4730, lng: 9.2000 },
    "California Bakery": { lat: 45.4700, lng: 9.1950 },
  },
  "Florence": {
    "Shake Café": { lat: 41.7740, lng: 11.2581 },
    "Rasputin Speakeasy": { lat: 41.7620, lng: 11.2470 },
    "Locale Firenze": { lat: 41.7700, lng: 11.2560 },
    "Love Craft Cocktail Bar": { lat: 41.7730, lng: 11.2620 },
    "Ditta Artigianale": { lat: 41.7690, lng: 11.2500 },
    "Melaleuca Bakery": { lat: 41.7710, lng: 11.2530 },
  },
  
  // ========== FRANCE ==========
  "Paris": {
    "Wild & The Moon": { lat: 48.8628, lng: 2.3622 },
    "Experimental Cocktail Club": { lat: 48.8545, lng: 2.3405 },
    "Bar Nouveau": { lat: 48.8600, lng: 2.3570 },
    "Le Toit de la Bellevilloise": { lat: 48.8680, lng: 2.3940 },
    "ROOF Paris (Hôtel Madame Rêve)": { lat: 48.8620, lng: 2.3450 },
    "Holybelly": { lat: 48.8710, lng: 2.3650 },
    "Hardware Société": { lat: 48.8740, lng: 2.3520 },
  },
  "Lyon": {
    "Le Kitchen Café": { lat: 45.7565, lng: 4.8360 },
    "Le G5": { lat: 45.7540, lng: 4.8330 },
    "Bar le Melhor": { lat: 45.7520, lng: 4.8370 },
    "Slake Coffee House": { lat: 45.7580, lng: 4.8340 },
    "Against the Grain": { lat: 45.7600, lng: 4.8380 },
  },
  
  // ========== GERMANY ==========
  "Berlin": {
    "The Green Market": { lat: 52.5260, lng: 13.4030 },
    "Monkey Bar": { lat: 52.5070, lng: 13.3371 },
    "Buck & Breck": { lat: 52.5390, lng: 13.4190 },
    "Green Door": { lat: 52.4950, lng: 13.3470 },
    "Father Carpenter": { lat: 52.5300, lng: 13.4100 },
    "House of Small Wonder": { lat: 52.5250, lng: 13.4050 },
  },
  "Munich": {
    "OhJulia (Marienplatz)": { lat: 48.1363, lng: 11.5761 },
    "Café Frischhut": { lat: 48.1340, lng: 11.5750 },
    "Madam Anna Ekke": { lat: 48.1380, lng: 11.5800 },
  },
  "Hamburg": {
    "Dean & David": { lat: 53.5520, lng: 10.0010 },
    "Le Lion Bar de Paris": { lat: 53.5500, lng: 10.0020 },
    "Clockers Bar": { lat: 53.5480, lng: 9.9610 },
    "The Good One Café": { lat: 53.5600, lng: 9.9900 },
    "Klippkroog": { lat: 53.5570, lng: 9.9700 },
  },
  
  // ========== UNITED KINGDOM ==========
  "London": {
    "Farmacy": { lat: 51.5108, lng: -0.2001 },
    "Swift Soho": { lat: 51.5130, lng: -0.1316 },
    "Nightjar": { lat: 51.5269, lng: -0.0875 },
    "The Connaught Bar": { lat: 51.5110, lng: -0.1482 },
    "Sunday in Brooklyn": { lat: 51.5200, lng: -0.0800 },
    "Granger & Co.": { lat: 51.5150, lng: -0.1950 },
  },
  "Manchester": {
    "Evelyn's Café Bar": { lat: 53.4834, lng: -2.2352 },
    "The Washhouse": { lat: 53.4850, lng: -2.2380 },
    "The Alchemist": { lat: 53.4810, lng: -2.2460 },
    "Federal Café": { lat: 53.4830, lng: -2.2340 },
    "Trof Northern Quarter": { lat: 53.4840, lng: -2.2360 },
  },
  "Edinburgh": {
    "Hula Juice Bar & Café": { lat: 55.9480, lng: -3.1910 },
    "The Dome": { lat: 55.9544, lng: -3.1988 },
    "The Bon Vivant": { lat: 55.9530, lng: -3.2000 },
    "Panda & Sons": { lat: 55.9540, lng: -3.2005 },
    "The Pantry": { lat: 55.9500, lng: -3.1950 },
    "Urban Angel": { lat: 55.9520, lng: -3.1980 },
  },
  
  // ========== IRELAND ==========
  "Dublin": {
    "Brother Hubbard (North)": { lat: 53.3494, lng: -6.2690 },
    "The Temple Bar Pub": { lat: 53.3454, lng: -6.2645 },
    "Two Boys Brew": { lat: 53.3450, lng: -6.2700 },
    "Herbstreet": { lat: 53.3480, lng: -6.2670 },
  },
  "Cork": {
    "Paradiso": { lat: 51.8969, lng: -8.4765 },
    "The Franciscan Well Brewpub": { lat: 51.9010, lng: -8.4830 },
    "Cafe Spresso": { lat: 51.8980, lng: -8.4750 },
    "Liberty Grill": { lat: 51.8990, lng: -8.4740 },
  },
  
  // ========== SWITZERLAND ==========
  "Zurich": {
    "Beetnut": { lat: 47.3740, lng: 8.5307 },
    "Raygrodski Bar": { lat: 47.3850, lng: 8.5320 },
    "Old Crow": { lat: 47.3710, lng: 8.5370 },
    "Widder Bar": { lat: 47.3730, lng: 8.5380 },
    "Babu's Bakery & Coffeehouse": { lat: 47.3760, lng: 8.5350 },
    "Kafi Dihei": { lat: 47.3780, lng: 8.5400 },
  },
  "Geneva": {
    "Birdie Food & Coffee": { lat: 46.2000, lng: 6.1370 },
    "L'Apothicaire Cocktail Club": { lat: 46.2050, lng: 6.1450 },
    "Le Verre à Monique": { lat: 46.2020, lng: 6.1400 },
    "Cottage Café": { lat: 46.2030, lng: 6.1420 },
    "Boréal Coffee Shop": { lat: 46.2040, lng: 6.1430 },
  },
  "Basel": {
    "La Manufacture": { lat: 47.5540, lng: 7.5890 },
    "Unternehmen Mitte": { lat: 47.5530, lng: 7.5920 },
    "Smilla Café": { lat: 47.5550, lng: 7.5900 },
    "Sandoase Beachbar": { lat: 47.5700, lng: 7.5850 },
  },
  
  // ========== AUSTRIA ==========
  "Vienna": {
    "Karma Food": { lat: 48.2082, lng: 16.3738 },
    "Blaue Bar (Sacher Hotel)": { lat: 48.2030, lng: 16.3690 },
    "Loos American Bar": { lat: 48.2050, lng: 16.3720 },
    "Café Motto am Fluss": { lat: 48.2100, lng: 16.3800 },
    "Blue Orange": { lat: 48.2070, lng: 16.3750 },
  },
  
  // ========== NETHERLANDS ==========
  "Amsterdam": {
    "Dignita": { lat: 52.3560, lng: 4.8900 },
    "Door 74": { lat: 52.3648, lng: 4.8935 },
    "Flying Dutchmen Cocktails": { lat: 52.3680, lng: 4.8890 },
    "CT Coffee & Coconuts": { lat: 52.3500, lng: 4.9100 },
    "The Avocado Show": { lat: 52.3620, lng: 4.8820 },
  },
  
  // ========== POLAND ==========
  "Warsaw": {
    "Tel Aviv Urban Food": { lat: 52.2310, lng: 21.0180 },
    "PiwPaw Beer Heaven": { lat: 52.2280, lng: 21.0170 },
    "Woda Ognista": { lat: 52.2230, lng: 21.0150 },
    "Bułkę przez Bibułkę": { lat: 52.2290, lng: 21.0200 },
    "Charlotte Menora": { lat: 52.2350, lng: 21.0220 },
  },
  
  // ========== USA ==========
  "New York City": {
    "Sweetgreen Broadway": { lat: 40.7589, lng: -73.9851 },
    "Jack's Wife Freda": { lat: 40.7230, lng: -73.9980 },
    "Bubby's": { lat: 40.7170, lng: -74.0080 },
  },
  "San Francisco": {
    "Souvla": { lat: 37.7850, lng: -122.4080 },
    "Foreign Cinema": { lat: 37.7580, lng: -122.4200 },
    "Plow": { lat: 37.7620, lng: -122.4110 },
  },
  "Los Angeles": {
    "The Butcher's Daughter": { lat: 34.0490, lng: -118.4470 },
    "Great White": { lat: 33.9970, lng: -118.4800 },
    "Gracias Madre": { lat: 34.0840, lng: -118.3880 },
  },
  "San Diego": {
    "Sweetgreen": { lat: 32.8700, lng: -117.2120 },
    "The Cottage La Jolla": { lat: 32.8500, lng: -117.2700 },
    "Breakfast Republic": { lat: 32.7600, lng: -117.1300 },
  },
  "Austin": {
    "Sweetgreen Downtown": { lat: 30.2672, lng: -97.7431 },
    "Josephine House": { lat: 30.2950, lng: -97.7550 },
    "Paperboy": { lat: 30.2700, lng: -97.7350 },
  },
  "Miami": {
    "Sweetgreen Coral Gables": { lat: 25.7400, lng: -80.2600 },
    "GreenStreet Café": { lat: 25.7480, lng: -80.2580 },
    "The Standard Spa Café": { lat: 25.7900, lng: -80.1400 },
  },
  "Boston": {
    "Sweetgreen Back Bay": { lat: 42.3510, lng: -71.0760 },
    "Tatte Bakery & Café": { lat: 42.3540, lng: -71.0700 },
    "The Friendly Toast": { lat: 42.3620, lng: -71.0560 },
  },
  "Dallas": {
    "Sweetgreen Uptown": { lat: 32.7950, lng: -96.8020 },
    "Yolk": { lat: 32.7870, lng: -96.7990 },
    "Bread Winners Café": { lat: 32.8100, lng: -96.8100 },
  },
  
  // ========== SCANDINAVIA ==========
  "Copenhagen": {
    "Ruby": { lat: 55.6760, lng: 12.5780 },
    "Lidkoeb": { lat: 55.6720, lng: 12.5530 },
    "Duck and Cover": { lat: 55.6700, lng: 12.5540 },
  },
  "Stockholm": {
    "Pharmarium": { lat: 59.3250, lng: 18.0710 },
    "Tjoget": { lat: 59.3160, lng: 18.0300 },
    "Lucy's Flower Shop": { lat: 59.3380, lng: 18.0750 },
  },
  "Oslo": {
    "Himkok Storgata Destilleri": { lat: 59.9160, lng: 10.7520 },
    "Blå": { lat: 59.9220, lng: 10.7600 },
    "Summit Bar": { lat: 59.9190, lng: 10.7400 },
  },
  
  // ========== EASTERN EUROPE ==========
  "Prague": {
    "Hemingway Bar": { lat: 50.0840, lng: 14.4170 },
    "Anonymous Bar": { lat: 50.0860, lng: 14.4200 },
    "Black Angel's Bar": { lat: 50.0870, lng: 14.4210 },
  },
  "Budapest": {
    "Szimpla Kert": { lat: 47.4960, lng: 19.0630 },
    "Instant-Fogas Complex": { lat: 47.4970, lng: 19.0620 },
    "Mazel Tov": { lat: 47.4980, lng: 19.0640 },
  },
  
  // ========== MIDDLE EAST ==========
  "Tel Aviv": {
    "Benedict": { lat: 32.0700, lng: 34.7750 },
    "Anastasia": { lat: 32.0720, lng: 34.7780 },
    "Café Xoho": { lat: 32.0680, lng: 34.7720 },
  },
  "Dubai": {
    "SEVA Table": { lat: 25.2000, lng: 55.2700 },
    "Bounty Beets": { lat: 25.1950, lng: 55.2750 },
    "The Sum of Us": { lat: 25.1900, lng: 55.2650 },
  },
  
  // ========== SOUTH AMERICA ==========
  "Medellín": {
    "Al Alma Café": { lat: 6.2100, lng: -75.5700 },
    "Pergamino Café": { lat: 6.2080, lng: -75.5680 },
    "El Social": { lat: 6.2120, lng: -75.5720 },
  },
  "Bogotá": {
    "Pergamino Café": { lat: 4.6670, lng: -74.0530 },
    "Abasto": { lat: 4.6690, lng: -74.0550 },
    "Masa": { lat: 4.6650, lng: -74.0510 },
  },
  "São Paulo": {
    "Santo Grão": { lat: -23.5700, lng: -46.6700 },
    "Lanchonete da Cidade": { lat: -23.5650, lng: -46.6650 },
    "Padaria da Cidade": { lat: -23.5750, lng: -46.6750 },
  },
  "Rio de Janeiro": {
    "Aprazível": { lat: -22.9300, lng: -43.1800 },
    "Talho Capixaba": { lat: -22.9680, lng: -43.1820 },
    "Belmonte": { lat: -22.9650, lng: -43.1750 },
  },
  
  // ========== MEXICO ==========
  "Mexico City": {
    "Lalo!": { lat: 19.4200, lng: -99.1700 },
    "Panadería Rosetta": { lat: 19.4180, lng: -99.1650 },
    "Niddo": { lat: 19.4220, lng: -99.1720 },
  },
};

// Helper function to get venue coordinates
export function getVenueCoordinates(city: string, venueName: string): VenueCoordinates | null {
  const cityVenues = VENUE_COORDINATES[city];
  if (!cityVenues) return null;
  
  // Try exact match first
  if (cityVenues[venueName]) {
    return cityVenues[venueName];
  }
  
  // Try partial match (venue name might be slightly different)
  const venueKey = Object.keys(cityVenues).find(key => 
    venueName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(venueName.toLowerCase())
  );
  
  return venueKey ? cityVenues[venueKey] : null;
}
