// Venue data for lunch, dinner, and brunch activities
// For drinks and hike, we keep "TBD - Vote in chat!"

export interface Venue {
  name: string;
  address: string;
}

export interface Bar {
  name: string;
  address: string;
}

export interface BrunchVenue {
  name: string;
  description: string;
}

// Brunch venues - 3 per city, rotates weekly within a month
export const CITY_BRUNCH_VENUES: Record<string, BrunchVenue[]> = {
  // Italy
  "Rome": [
    { name: "Ginger Sapori e Salute", description: "Healthy, stylish, central" },
    { name: "Barnum Café", description: "Creative brunch, international crowd" },
    { name: "Coromandel", description: "Cozy, artistic, brunch classics" },
  ],
  "Milan": [
    { name: "That's Vapore", description: "Modern Italian, great setting" },
    { name: "Pavé", description: "Iconic brunch bakery" },
    { name: "California Bakery", description: "Reliable brunch classic" },
  ],
  "Florence": [
    { name: "Shake Café", description: "International, clean, modern" },
    { name: "Ditta Artigianale", description: "Coffee-driven brunch culture" },
    { name: "Melaleuca Bakery", description: "Popular with expats & creatives" },
  ],
  
  // France
  "Paris": [
    { name: "Wild & The Moon", description: "Plant-based, premium vibe" },
    { name: "Holybelly", description: "Best classic brunch in town" },
    { name: "Hardware Société", description: "Australian-style brunch" },
  ],
  "Lyon": [
    { name: "Le Kitchen Café", description: "Brunch institution" },
    { name: "Slake Coffee House", description: "Trendy & social" },
    { name: "Against the Grain", description: "Modern, international" },
  ],
  
  // Germany
  "Berlin": [
    { name: "The Green Market", description: "Healthy, urban" },
    { name: "Father Carpenter", description: "Minimal, high quality" },
    { name: "House of Small Wonder", description: "Iconic brunch spot" },
  ],
  "Munich": [
    { name: "OhJulia (Marienplatz)", description: "Stylish & central" },
    { name: "Café Frischhut", description: "Classic Bavarian brunch" },
    { name: "Madam Anna Ekke", description: "Trendy & social" },
  ],
  "Hamburg": [
    { name: "Dean & David", description: "Healthy & scalable" },
    { name: "The Good One Café", description: "Specialty brunch" },
    { name: "Klippkroog", description: "Local favorite" },
  ],
  
  // United Kingdom
  "London": [
    { name: "Farmacy", description: "Plant-based brunch hotspot" },
    { name: "Sunday in Brooklyn", description: "Brunch icon" },
    { name: "Granger & Co.", description: "Australian-style classic" },
  ],
  "Manchester": [
    { name: "Evelyn's Café Bar", description: "Brunch + social vibe" },
    { name: "Federal Café", description: "Consistent & popular" },
    { name: "Trof Northern Quarter", description: "Relaxed brunch crowd" },
  ],
  "Birmingham": [
    { name: "Natural Bar & Kitchen", description: "Healthy & modern" },
    { name: "Cherry Reds Café Bar", description: "Casual brunch" },
    { name: "Medicine Bakery", description: "High-quality brunch" },
  ],
  "Edinburgh": [
    { name: "Hula Juice Bar & Café", description: "Healthy & social" },
    { name: "The Pantry", description: "Local brunch favorite" },
    { name: "Urban Angel", description: "Modern & cozy" },
  ],
  
  // Ireland
  "Dublin": [
    { name: "Brother Hubbard (North)", description: "Brunch leader" },
    { name: "Two Boys Brew", description: "Trendy crowd" },
    { name: "Herbstreet", description: "Quality & consistency" },
  ],
  "Cork": [
    { name: "Paradiso", description: "Vegetarian fine brunch" },
    { name: "Cafe Spresso", description: "Casual & social" },
    { name: "Liberty Grill", description: "Reliable brunch classic" },
  ],
  
  // Switzerland
  "Zurich": [
    { name: "Beetnut", description: "Clean, modern, scalable" },
    { name: "Babu's Bakery & Coffeehouse", description: "Top brunch" },
    { name: "Kafi Dihei", description: "Cozy & popular" },
  ],
  "Geneva": [
    { name: "Birdie Food & Coffee", description: "International brunch" },
    { name: "Cottage Café", description: "Classic brunch vibes" },
    { name: "Boréal Coffee Shop", description: "Trendy & social" },
  ],
  "Basel": [
    { name: "La Manufacture", description: "Stylish brunch" },
    { name: "Unternehmen Mitte", description: "Community hub" },
    { name: "Smilla Café", description: "Local favorite" },
  ],
  
  // Austria
  "Vienna": [
    { name: "Karma Food", description: "Healthy & modern" },
    { name: "Café Motto am Fluss", description: "Brunch with views" },
    { name: "Blue Orange", description: "Trendy brunch scene" },
  ],
  "Innsbruck": [
    { name: "Ludwig Das Burger Restaurant", description: "Casual brunch" },
    { name: "Café Munding", description: "Classic & central" },
    { name: "Breakfast Club", description: "Modern & popular" },
  ],
  
  // Poland
  "Warsaw": [
    { name: "Tel Aviv Urban Food", description: "Brunch icon" },
    { name: "Bułkę przez Bibułkę", description: "Trendy & social" },
    { name: "Charlotte Menora", description: "French-style brunch" },
  ],
  
  // USA
  "New York City": [
    { name: "Sweetgreen Broadway", description: "Healthy & scalable" },
    { name: "Jack's Wife Freda", description: "Brunch institution" },
    { name: "Bubby's", description: "Classic American brunch" },
  ],
  "San Francisco": [
    { name: "Souvla", description: "Casual & social" },
    { name: "Foreign Cinema", description: "Iconic brunch" },
    { name: "Plow", description: "SF brunch legend" },
  ],
  "Los Angeles": [
    { name: "The Butcher's Daughter", description: "Brunch hotspot" },
    { name: "Great White", description: "Beachy brunch vibe" },
    { name: "Gracias Madre", description: "Vegan Mexican brunch" },
  ],
  "San Diego": [
    { name: "The Cottage La Jolla", description: "Classic brunch" },
    { name: "Breakfast Republic", description: "Popular & social" },
    { name: "Herb & Wood", description: "Upscale brunch" },
  ],
  "Austin": [
    { name: "Sweetgreen Downtown", description: "Clean & scalable" },
    { name: "Josephine House", description: "Stylish brunch" },
    { name: "Paperboy", description: "Austin brunch icon" },
  ],
  "Dallas": [
    { name: "Sweetgreen Uptown", description: "Reliable" },
    { name: "Yolk", description: "Brunch classic" },
    { name: "Bread Winners Café", description: "Social brunch spot" },
  ],
  "Miami": [
    { name: "Sweetgreen Coral Gables", description: "Clean & modern" },
    { name: "GreenStreet Café", description: "Iconic brunch" },
    { name: "The Standard Spa Café", description: "Wellness brunch" },
  ],
  "Boston": [
    { name: "Sweetgreen Back Bay", description: "Consistent" },
    { name: "Tatte Bakery & Café", description: "Brunch favorite" },
    { name: "The Friendly Toast", description: "Fun brunch vibe" },
  ],
  
  // Spain
  "Barcelona": [
    { name: "Brunch & Cake", description: "Popular brunch spot" },
    { name: "Federal Café", description: "Consistent & popular" },
    { name: "Flax & Kale", description: "Healthy brunch" },
  ],
  "Madrid": [
    { name: "Brunch & Cake", description: "Popular brunch spot" },
    { name: "Federal Café", description: "Consistent & popular" },
    { name: "Flax & Kale", description: "Healthy brunch" },
  ],
  
  // Portugal
  "Lisbon": [
    { name: "Amélia Café", description: "Charming brunch spot" },
    { name: "Heim Café", description: "Cozy brunch" },
    { name: "Copenhagen Coffee Lab", description: "Nordic-style brunch" },
  ],
  "Porto": [
    { name: "Seagull Method Café", description: "Trendy brunch" },
    { name: "Zenith Brunch & Cocktails", description: "Modern brunch" },
    { name: "O Diplomata", description: "Classic Portuguese" },
  ],
  
  // Netherlands
  "Amsterdam": [
    { name: "Dignita", description: "Social enterprise brunch" },
    { name: "CT Coffee & Coconuts", description: "Iconic brunch spot" },
    { name: "The Avocado Show", description: "Instagram-worthy brunch" },
  ],
  
  // Mexico
  "Mexico City": [
    { name: "Lalo!", description: "Popular brunch spot" },
    { name: "Panadería Rosetta", description: "Bakery brunch" },
    { name: "Niddo", description: "Modern Mexican brunch" },
  ],
  
  // Israel
  "Tel Aviv": [
    { name: "Benedict", description: "24/7 breakfast" },
    { name: "Anastasia", description: "Vegan brunch" },
    { name: "Café Xoho", description: "Trendy brunch" },
  ],
  
  // Colombia
  "Medellín": [
    { name: "Al Alma Café", description: "Cozy brunch spot" },
    { name: "Pergamino Café", description: "Coffee-driven brunch" },
    { name: "El Social", description: "Local favorite" },
  ],
  "Bogotá": [
    { name: "Pergamino Café", description: "Coffee-driven brunch" },
    { name: "Abasto", description: "Modern brunch" },
    { name: "Masa", description: "Artisan bakery brunch" },
  ],
  
  // Brazil
  "São Paulo": [
    { name: "Santo Grão", description: "Coffee & brunch" },
    { name: "Lanchonete da Cidade", description: "Classic São Paulo" },
    { name: "Padaria da Cidade", description: "Bakery brunch" },
  ],
  "Rio de Janeiro": [
    { name: "Aprazível", description: "Garden brunch" },
    { name: "Talho Capixaba", description: "Classic brunch" },
    { name: "Belmonte", description: "Traditional brunch" },
  ],
  
  // UAE
  "Dubai": [
    { name: "SEVA Table", description: "Wellness brunch" },
    { name: "Bounty Beets", description: "Healthy brunch" },
    { name: "The Sum of Us", description: "Popular brunch spot" },
  ],
};

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
  "New York City": {
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
  
  // Colombia
  "Bogotá": {
    name: "Crepes & Waffles",
    address: "Carrera 9 No. 73-33, Bogotá"
  },
  "Medellín": {
    name: "Pergamino Café",
    address: "Carrera 37 No. 8A-37, El Poblado, Medellín"
  },
  "Cartagena": {
    name: "Juan del Mar",
    address: "Calle del Santísimo, Cartagena"
  },
};

// Bars list per city - rotates daily
export const CITY_BARS: Record<string, Bar[]> = {
  // ========== EUROPE ==========
  
  // Germany
  "Berlin": [
    { name: "Monkey Bar", address: "25hours Hotel, Budapester Strasse 40, 10787 Berlin" },
    { name: "Buck & Breck", address: "Pappelallee 64, 10437 Berlin" },
    { name: "Green Door", address: "Motzstrasse 24, 10777 Berlin" },
    { name: "Pawn Dot Com Bar", address: "Torstraße 94, 10119 Berlin" },
    { name: "The Curtain Club (Ritz-Carlton)", address: "Potsdamer Platz 3, 10785 Berlin" },
    { name: "The Wash Bar", address: "Rosenthaler Platz area, Berlin" },
    { name: "Tire Bouchon", address: "Schlosshotel Grunewald, Königin-Luise-Strasse 49, 14195 Berlin" },
  ],
  "Hamburg": [
    { name: "Le Lion Bar de Paris", address: "Rathausstraße 3, 20095 Hamburg" },
    { name: "Clockers Bar", address: "Paul-Roosen-Str. 27, 22767 Hamburg" },
    { name: "The Chug Club", address: "Taubenstraße 13, 20359 Hamburg" },
    { name: "The Boilerman Bar", address: "Eppendorfer Weg 211, 20253 Hamburg" },
    { name: "Skyline Bar 20up", address: "Reeperbahn 1, 20459 Hamburg" },
    { name: "Herzblut St. Pauli", address: "Reeperbahn 50, 20359 Hamburg" },
    { name: "Drip Bar", address: "Ferdinandstraße 47, 20095 Hamburg" },
  ],
  
  // Spain
  "Madrid": [
    { name: "Salmon Guru", address: "Costanilla de San Andrés 10, 28005 Madrid" },
    { name: "1862 Dry Bar", address: "Calle del Pez 27, 28004 Madrid" },
    { name: "Angelita Madrid", address: "Calle de San Vicente Ferrer 11, 28004 Madrid" },
    { name: "La Venencia", address: "Calle de Echegaray 7, 28014 Madrid" },
    { name: "Jack's Library", address: "Calle de Echegaray 21, 28014 Madrid" },
    { name: "Ficus Bar", address: "Calle de Princesa 15, 28008 Madrid" },
    { name: "Santoría", address: "Calle de Salamanca, Madrid" },
  ],
  "Barcelona": [
    { name: "Las Vermudas", address: "Carrer del Robí 32, 08024 Barcelona" },
    { name: "Elephanta Gin Bar", address: "Gràcia neighbourhood, Barcelona" },
    { name: "Paradiso", address: "Carrer de Rera Palau 4, Barcelona" },
    { name: "Dry Martini Bar", address: "C/ Aribau 162, 08036 Barcelona" },
    { name: "Bar Marsella", address: "Carrer de Sant Pau, El Raval, Barcelona" },
    { name: "Sips", address: "C/ de Muntaner, Eixample Esquerra, Barcelona" },
    { name: "L'Anima del Vi", address: "Born district, Barcelona" },
  ],
  
  // France
  "Paris": [
    { name: "Experimental Cocktail Club", address: "37 Rue Saint-Sulpice, 75006 Paris" },
    { name: "Bar Nouveau", address: "5 Rue des Haudriettes, 75003 Paris" },
    { name: "Le Toit de la Bellevilloise", address: "19 Rue Boyer, 75020 Paris" },
    { name: "ROOF Paris (Hôtel Madame Rêve)", address: "10 Rue d'Artois, 75008 Paris" },
    { name: "Bisou Canal", address: "33 Rue Saint-Maur, 75011 Paris" },
    { name: "Dealer Bar", address: "55 Rue de Rivoli, 75004 Paris" },
    { name: "Comptoir De Vie", address: "48 Rue de Rivoli, 75004 Paris" },
  ],
  "Lyon": [
    { name: "Le G5", address: "76 rue de la Charité, 69002 Lyon" },
    { name: "Bar le Melhor", address: "20 quai Gailleton, 69002 Lyon" },
    { name: "Le Fantôme de l'Opéra", address: "19 rue Royale, 69001 Lyon" },
    { name: "Light Bar", address: "20 quai Gailleton, 69002 Lyon" },
    { name: "L'Officine", address: "3 cour Saint-Henri, Grand Hôtel-Dieu, 69002 Lyon" },
    { name: "Wallace Pub Vaise", address: "8 rue de la Claire, 69009 Lyon" },
    { name: "Wallace Bar", address: "2 rue Octavio Mey, 69005 Lyon" },
  ],
  
  // Austria
  "Vienna": [
    { name: "Blaue Bar (Sacher Hotel)", address: "Philharmoniker Strasse 4, 1010 Vienna" },
    { name: "Bar Pani", address: "Vienna" },
    { name: "Loos American Bar", address: "Kärntner Durchgang 10, 1010 Vienna" },
    { name: "Kleinod Prunkstück", address: "City-centre, Vienna" },
    { name: "The BirdYard", address: "8th Neubau district, Vienna" },
    { name: "If Dogs Run Free", address: "6th district, Vienna" },
    { name: "Miranda Bar", address: "Vienna" },
  ],
  
  // Portugal
  "Lisbon": [
    { name: "Pensão Amor", address: "R. do Alecrim 19, 1200-018 Lisbon" },
    { name: "Toca da Raposa", address: "R. da Condessa 45, 1200-096 Lisbon" },
    { name: "Imprensa Cocktail & Oyster Bar", address: "R. da Imprensa Nacional 46, 1200-161 Lisbon" },
    { name: "Park Rooftop Bar", address: "Calçada do Comercio 2, 1200-115 Lisbon" },
    { name: "IF IF IF", address: "R. do Salitre 122B, 1269-066 Lisbon" },
    { name: "Sneaky Sip", address: "Lisbon" },
    { name: "BacoAlto", address: "Lisbon" },
  ],
  "Porto": [
    { name: "The Royal Cocktail Club", address: "Rua da Fábrica 105, Porto" },
    { name: "Base Porto", address: "Jardim das Oliveiras, Clérigos, Porto" },
    { name: "Bonaparte Downtown", address: "Praça Guilherme Gomes Fernandes 40, Porto" },
    { name: "Mirajazz", address: "Cais das Pedras 5, Porto" },
    { name: "Café Candelabro", address: "Rua da Conceição 3, Porto" },
    { name: "Adega Leonor", address: "Rua do Almada 125, Porto" },
    { name: "Black Mamba Bar", address: "Rua do Almada 95, Porto" },
  ],
  
  // Italy
  "Milan": [
    { name: "Nottingham Forest", address: "Milan city centre" },
    { name: "Camparino en Galleria", address: "Galleria Vittorio Emanuele II area, Milan" },
    { name: "Mag Café", address: "Navigli district, Milan" },
    { name: "Terrazza Aperol", address: "Historic centre near Duomo, Milan" },
    { name: "Bar Basso", address: "Milan" },
    { name: "La Chiesetta Bar", address: "Northwest Milan" },
    { name: "Mom Café Bar", address: "Milan centre" },
  ],
  "Rome": [
    { name: "Jerry Thomas Project", address: "Rome" },
    { name: "Freni e Fricioni", address: "Rome" },
    { name: "Drink Kong", address: "Rome" },
    { name: "Bar San Calisto", address: "Trastevere, Rome" },
    { name: "Big Hilda", address: "Trastevere, Rome" },
    { name: "Otivm Roof Bar", address: "Rome" },
    { name: "Terrazza Les Étoiles", address: "Rome" },
  ],
  "Florence": [
    { name: "Rasputin Speakeasy", address: "Via del Campuccio 61R, 50125 Firenze" },
    { name: "Locale Firenze", address: "Via delle Seggiole 12R, 50122 Firenze" },
    { name: "Love Craft Cocktail Bar", address: "Via dei Macci 84R, 50122 Firenze" },
    { name: "Mayday Club", address: "Via Dante Alighieri 16R, 50122 Firenze" },
    { name: "Ditta Artigianale Spirits Bar", address: "Via dello Sprone 5R, 50125 Firenze" },
    { name: "Move On", address: "Piazza di Santa Maria Novella 6R, 50123 Firenze" },
    { name: "Colle Bereto", address: "Piazza Strozzi 5R, 50123 Firenze" },
  ],
  
  // Switzerland
  "Basel": [
    { name: "Sandoase Beachbar", address: "Westquaistrasse 75, 4057 Basel" },
    { name: "Les Trois Rois Bar", address: "Blumenrain 8, 4001 Basel" },
    { name: "Basso", address: "Basel" },
    { name: "Baragraph", address: "Basel" },
    { name: "VinOptimum Enoteca", address: "Basel" },
    { name: "ManaBar", address: "Basel" },
    { name: "Volta Bräu", address: "Basel" },
  ],
  "Zurich": [
    { name: "Raygrodski Bar", address: "Neugasse 56, 8005 Zürich" },
    { name: "Old Crow", address: "Schwanengasse 4, 8001 Zürich" },
    { name: "Widder Bar", address: "Rennweg 7, 8001 Zürich" },
    { name: "Dante Bar", address: "Gasometerstrasse 5, 8005 Zürich" },
    { name: "Boiler Room Bar", address: "Neugasse 60, 8005 Zürich" },
    { name: "Tales Bar", address: "Selnaustrasse 29, 8001 Zürich" },
    { name: "Les Halles", address: "Pfingstweidstrasse 6, 8005 Zürich" },
  ],
  "Geneva": [
    { name: "L'Apothicaire Cocktail Club", address: "Rue de l'Arquebuse 20, 1204 Geneva" },
    { name: "Le Verre à Monique", address: "Rue de l'Ecole-de-Médecine 9, 1205 Geneva" },
    { name: "Coutume Bar", address: "Rue Prévost-Martin 5, 1205 Geneva" },
    { name: "Black Tap Craft Burgers & Beer", address: "Quai du Mont-Blanc 19, 1201 Geneva" },
    { name: "La Clémence", address: "Place du Bourg-de-Four 20, 1204 Geneva" },
    { name: "Barbershop Geneva", address: "Rue de l'Arquebuse 61, 1205 Geneva" },
    { name: "Arthur's Rive Gauche", address: "Rue du Rhône 7, 1204 Geneva" },
  ],
  
  // Ireland
  "Dublin": [
    { name: "The Temple Bar Pub", address: "Temple Bar district, Dublin" },
    { name: "Stag's Head", address: "Dublin" },
    { name: "The Long Hall", address: "Dublin" },
    { name: "Kehoes Pub", address: "Dublin" },
    { name: "The Brazen Head", address: "Dublin" },
    { name: "Devitt's Pub", address: "Dublin" },
    { name: "The Cobblestone", address: "Dublin" },
  ],
  "Cork": [
    { name: "The Franciscan Well Brewpub", address: "North Mall, Cork" },
    { name: "The Crane Lane Theatre", address: "Phoenix St, Cork" },
    { name: "Electric Bar", address: "South Mall, Cork" },
    { name: "Cask Bar", address: "48 MacCurtain Street, Cork" },
    { name: "The Roundy", address: "Castle Street, Cork" },
    { name: "Mutton Lane Inn", address: "Mutton Lane, Cork" },
    { name: "An Brod", address: "89 Oliver Plunkett St, Cork" },
  ],
  
  // United Kingdom
  "London": [
    { name: "Swift Soho", address: "12 Old Compton St, Soho, London W1D 4TQ" },
    { name: "Nightjar", address: "129 City Rd, Shoreditch, London EC1V 1JB" },
    { name: "The Connaught Bar", address: "The Connaught Hotel, Carlos Pl, London W1K 2AL" },
    { name: "Cahoots", address: "13 Kingly Ct, Soho, London W1B 5PW" },
    { name: "Bar Termini", address: "7 Old Compton St, Soho, London W1D 5JE" },
    { name: "Callooh Callay", address: "65 Rivington St, Shoreditch, London EC2A 3AY" },
    { name: "The Churchill Arms", address: "119 Kensington Church St, Kensington, London W8 7LN" },
  ],
  "Manchester": [
    { name: "The Washhouse", address: "19 Shudehill, Manchester M4 2AF" },
    { name: "The Alchemist", address: "1 New York St, Manchester M1 4HD" },
    { name: "Science & Industry", address: "49-51 Thomas St, Manchester M4 1NA" },
    { name: "20 Stories", address: "No. 1 Spinningfields, Hardman Square, Manchester M3 3EB" },
    { name: "The Liars Club", address: "19A Back Bridge St, Manchester M3 2PB" },
    { name: "Cloud 23", address: "303 Deansgate, Hilton Hotel, Manchester M3 4LQ" },
    { name: "YES", address: "38 Charles St, Manchester M1 7DB" },
  ],
  "Edinburgh": [
    { name: "The Dome", address: "14 George Street, Edinburgh EH2 2PF" },
    { name: "The Bon Vivant", address: "55 Thistle St, Edinburgh EH2 1DY" },
    { name: "The Lucky Liquor Co", address: "Edinburgh" },
    { name: "The False Widow", address: "Edinburgh" },
    { name: "Panda & Sons", address: "79 Queen St, Edinburgh EH2 4NF" },
    { name: "Bramble Bar & Lounge", address: "16A Queen St, Edinburgh EH2 1JE" },
    { name: "The Devil's Advocate", address: "9 Advocate's Cl, Edinburgh EH1 1ND" },
  ],
  
  // Netherlands
  "Amsterdam": [
    { name: "Door 74", address: "Reguliersdwarsstraat 74, 1017 BN Amsterdam" },
    { name: "Flying Dutchmen Cocktails", address: "Singel 460, 1017 AW Amsterdam" },
    { name: "Bar Oldenhof", address: "Elandsgracht 84, 1016 TZ Amsterdam" },
    { name: "Tales & Spirits", address: "Lijnbaanssteeg 5-7, 1012 TE Amsterdam" },
    { name: "Hannekes Boom", address: "Dijksgracht 4, 1019 BS Amsterdam" },
    { name: "SkyLounge Amsterdam", address: "Oosterdoksstraat 4, 1011 DK Amsterdam" },
    { name: "Café de Dokter", address: "Rozenboomsteeg 4, 1012 PR Amsterdam" },
  ],
  
  // Denmark
  "Copenhagen": [
    { name: "Ruby", address: "Nybrogade 10, 1203 København K" },
    { name: "Lidkoeb", address: "Vesterbrogade 72B, 1620 København V" },
    { name: "Duck and Cover", address: "Dannebrogsgade 6, 1660 København V" },
    { name: "Curfew", address: "Stenosgade 1, 1616 København V" },
    { name: "BRUS", address: "Guldbergsgade 29, 2200 København N" },
    { name: "The Jane", address: "Gråbrødretorv 8, 1154 København K" },
    { name: "1105 Bar", address: "Kristen Bernikows Gade 4, 1105 København K" },
  ],
  
  // Sweden
  "Stockholm": [
    { name: "Pharmarium", address: "Stortorget 7, Gamla Stan, 111 29 Stockholm" },
    { name: "Tjoget", address: "Hornsbruksgatan 24, 117 34 Stockholm" },
    { name: "Lucy's Flower Shop", address: "Birger Jarlsgatan 20, 114 34 Stockholm" },
    { name: "Cadier Bar (Grand Hôtel)", address: "Södra Blasieholmshamnen 8, 103 27 Stockholm" },
    { name: "Himlen Skybar", address: "Götgatan 78, 118 30 Stockholm" },
    { name: "Marie Laveau", address: "Hornsgatan 66, 118 21 Stockholm" },
    { name: "Corner Club", address: "Lilla Nygatan 16, 111 28 Stockholm" },
  ],
  
  // Norway
  "Oslo": [
    { name: "Himkok Storgata Destilleri", address: "Storgata 27, 0184 Oslo" },
    { name: "Blå", address: "Brenneriveien 9, 0182 Oslo" },
    { name: "Summit Bar", address: "Holbergs gate 30, 0166 Oslo" },
    { name: "Torggata Botaniske", address: "Torggata 17B, 0183 Oslo" },
    { name: "Andre Til Høyre", address: "Youngs gate 19, 0181 Oslo" },
    { name: "The Villa", address: "Møllergata 23-25, 0179 Oslo" },
    { name: "Tilt", address: "Torggata 16, 0181 Oslo" },
  ],
  
  // Czech Republic
  "Prague": [
    { name: "Hemingway Bar", address: "Karoliny Světlé 26, 110 00 Staré Město" },
    { name: "Anonymous Bar", address: "Michalská 432/12, 110 00 Staré Město" },
    { name: "Black Angel's Bar", address: "Staroměstské nám. 29, 110 00 Prague" },
    { name: "Cash Only Bar", address: "Liliová 3, 110 00 Staré Město" },
    { name: "Tretter's Bar", address: "V Kolkovně 3, 110 00 Prague" },
    { name: "Bugsy's Bar", address: "Pařížská 10, 110 00 Prague" },
    { name: "Cloud 9 Sky Bar & Lounge", address: "Pobřežní 1, 186 00 Prague" },
  ],
  
  // Hungary
  "Budapest": [
    { name: "Szimpla Kert", address: "Kazinczy u. 14, 1075 Budapest" },
    { name: "Instant-Fogas Complex", address: "Akácfa u. 49–51, 1073 Budapest" },
    { name: "Mazel Tov", address: "Akácfa u. 47, 1072 Budapest" },
    { name: "Kiosk Budapest", address: "Március 15. tér 4, 1056 Budapest" },
    { name: "High Note SkyBar", address: "Hercegprímás u. 5, 1051 Budapest" },
    { name: "Puder Bar", address: "Ráday u. 8, 1092 Budapest" },
    { name: "Warmup Bar", address: "Kertész u. 29, 1073 Budapest" },
  ],
  
  // Poland
  "Warsaw": [
    { name: "PiwPaw Beer Heaven", address: "Foksal 16, 00-372 Warsaw" },
    { name: "Woda Ognista", address: "Wilcza 8, 00-538 Warsaw" },
    { name: "Kita Koguta", address: "Krucza 6/14, 00-537 Warsaw" },
    { name: "Loreta Bar (PURO Hotel)", address: "Widok 9, 00-023 Warsaw" },
    { name: "Hala Koszyki Bar Zone", address: "Koszykowa 63, 00-667 Warsaw" },
    { name: "Bar Studio", address: "Palace of Culture, Plac Defilad 1, Warsaw" },
    { name: "Zamieszanie Cocktail Bar", address: "Waryńskiego 9, 00-655 Warsaw" },
  ],
  
  // Romania
  "Bucharest": [
    { name: "Line Bar", address: "Calea Victoriei 17, Bucharest" },
    { name: "Fix Me a Drink", address: "Strada Șelari 17, Bucharest" },
    { name: "Control Club Bar", address: "Str. Constantin Mille 4, Bucharest" },
    { name: "Nomad Skybar", address: "Strada Smârdan 30, Bucharest" },
    { name: "Interbelic Cocktail Bar", address: "Str. Selari 19, Bucharest" },
    { name: "The Urbanist", address: "Strada Franceză 46, Bucharest" },
    { name: "Pura Vida Sky Bar", address: "Strada Smârdan 7, Bucharest" },
  ],
  
  // Serbia
  "Belgrade": [
    { name: "Bar Central", address: "Kralja Petra 59, Belgrade" },
    { name: "Blaznavac Bar", address: "Kneginje Ljubice 18, Belgrade" },
    { name: "Ludost Bar", address: "Karadjordjeva 44, Belgrade" },
    { name: "Rakija Bar", address: "Strahinjića Bana 12, Belgrade" },
    { name: "Toro Latin Gastrobar", address: "Beton Hala, Karadjordjeva 2-4, Belgrade" },
    { name: "Hanky Panky Bar", address: "Uzun Mirkova 5, Belgrade" },
    { name: "Bistro Grad", address: "Cetinjska 3, Belgrade" },
  ],
  
  // Croatia
  "Zagreb": [
    { name: "Swanky Monkey Garden Bar", address: "Ilica 50, Zagreb" },
    { name: "Program Bar", address: "Martićeva 14F, Zagreb" },
    { name: "Amost Bar", address: "Frankopanska 7, Zagreb" },
    { name: "The Garden Brewery Taproom", address: "Illica 222, Zagreb" },
    { name: "Out Garden Rooftop Bar", address: "Ul. Grgura Ninskog 3, Zagreb" },
    { name: "Tesla Power House", address: "Varšavska ul. 5, Zagreb" },
    { name: "Dežman Bar", address: "Dežmanova ul. 3, Zagreb" },
  ],
  
  // Greece
  "Athens": [
    { name: "The Clumsies", address: "Praxitelous 30, Athens" },
    { name: "Baba au Rum", address: "Kleitiou 6, Athens" },
    { name: "360 Cocktail Bar", address: "Ifestou 2, Monastiraki Square, Athens" },
    { name: "Six d.o.g.s", address: "Avramiotou 6-8, Athens" },
    { name: "A for Athens Bar", address: "Miaouli 2-4, Athens" },
    { name: "Drunk Sinatra", address: "Thiseos 16, Athens" },
    { name: "Juan Rodriguez Bar", address: "Papagou 3, Athens" },
  ],
  
  // Finland
  "Helsinki": [
    { name: "Liberty or Death", address: "Erottajankatu 5, Helsinki" },
    { name: "Trillby & Chadwick", address: "Katariinankatu 3, Helsinki" },
    { name: "Ateljee Bar", address: "Yrjönkatu 26, Hotel Torni, Helsinki" },
    { name: "Bier-Bier", address: "Erottajankatu 13, Helsinki" },
    { name: "Siltanen", address: "Hämeentie 13, Helsinki" },
    { name: "Ullanlinnan Kasino", address: "Iso Puistotie 1, Helsinki" },
    { name: "Yes Yes Yes Bar", address: "Iso Roobertinkatu 1, Helsinki" },
  ],
  
  // Slovakia
  "Bratislava": [
    { name: "Michalská Cocktail Room", address: "Michalská 5, Bratislava" },
    { name: "Urban House", address: "Laurinská 14, Bratislava" },
    { name: "The Old Fashioned Bar", address: "Laurinská 8, Bratislava" },
    { name: "Lemontree Sky Bar", address: "Hviezdoslavovo námestie 7, Bratislava" },
    { name: "Nu Spirit Bar", address: "Šafárikovo nám. 7, Bratislava" },
    { name: "Fuga Bar", address: "Námestie SNP 24, Bratislava" },
    { name: "Bukowski Bar", address: "Námestie SNP 28, Bratislava" },
  ],
  
  // Belgium
  "Brussels": [
    { name: "Delirium Café", address: "Impasse de la Fidélité 4A, Brussels" },
    { name: "A La Mort Subite", address: "Rue Montagne aux Herbes Potagères 7, Brussels" },
    { name: "Café Belga", address: "Place Eugène Flagey 18, Brussels" },
    { name: "Madame Moustache", address: "Quai au Bois à Brûler 5-7, Brussels" },
    { name: "Moeder Lambic Fontainas", address: "Place Fontainas 8, Brussels" },
    { name: "Le Cercueil", address: "Rue des Harengs 10, Brussels" },
    { name: "Bar des Amis", address: "Rue Sainte-Catherine 30, Brussels" },
  ],
  
  // UK - Additional cities
  "Liverpool": [
    { name: "Berry & Rye", address: "48 Berry St, Liverpool L1 4JQ" },
    { name: "The Merchant", address: "40 Slater St, Liverpool L1 4BX" },
    { name: "Present Company", address: "37-39 School Ln, Liverpool L1 3DA" },
    { name: "The Alchemist", address: "5 Brunswick St, Liverpool L2 0UU" },
    { name: "Ex-Directory", address: "Liverpool city centre (secret entrance)" },
    { name: "Red Door", address: "21-23 Berry St, Liverpool L1 9DF" },
    { name: "Botanical Garden", address: "New Bird St, Liverpool L1 0BW" },
  ],
  "Bristol": [
    { name: "Hyde & Co", address: "Upper Byron Pl, Bristol BS8 1JY" },
    { name: "The Milk Thistle", address: "Quay Head House, Colston Ave, Bristol BS1 4UA" },
    { name: "Her Majesty's Secret Service", address: "Whiteladies Rd, Bristol BS8 2PH" },
    { name: "Filthy XIII", address: "Cheltenham Rd, Bristol BS6 5RL" },
    { name: "The Rummer Hotel", address: "All Saints Ln, Bristol BS1 1JH" },
    { name: "The Apple", address: "Welsh Back, Bristol BS1 4SB" },
    { name: "Small Bar", address: "King St, Bristol BS1 4EF" },
  ],
  
  // ========== USA ==========
  
  "Boston": [
    { name: "Farmacia", address: "5 N Square, Boston, MA 02128" },
    { name: "Yvonne's", address: "2 Winter Pl, Boston, MA 02108" },
    { name: "Wusong Road", address: "112 Mt Auburn St, Cambridge, MA 02138" },
    { name: "Blossom Bar", address: "295 Washington St, Brookline, MA 02445" },
    { name: "haley.henry", address: "45 Province St, Boston, MA 02108" },
    { name: "Offsuit", address: "7 Sanborn Ct, Somerville, MA 02143" },
    { name: "The Dark Bar", address: "Boston Harbor Hotel, Boston, MA" },
  ],
  "Dallas": [
    { name: "The Tipsy Alchemist", address: "2101 Cedar Springs Rd Suite R125, Dallas, TX 75201" },
    { name: "HIDE Bar", address: "1928 Greenville Ave, Dallas, TX 75206" },
    { name: "Rodeo Bar (The Adolphus Hotel)", address: "Dallas, TX" },
    { name: "LadyLove Lounge & Sound", address: "Dallas, TX" },
    { name: "Bar Colette", address: "Dallas, TX" },
    { name: "Midnight Rambler", address: "Dallas, TX" },
    { name: "Black Swan Saloon", address: "Dallas, TX" },
  ],
  "Los Angeles": [
    { name: "The Lincoln", address: "2536 Lincoln Blvd, Los Angeles, CA 90291" },
    { name: "Belles Beach House", address: "Venice, CA" },
    { name: "Kassi Rooftop Venice Beach", address: "Venice, CA" },
    { name: "The Brig", address: "1515 Abbot Kinney Blvd, Venice, CA 90291" },
    { name: "Thunderbolt", address: "Los Angeles, CA" },
    { name: "The Roger Room", address: "Los Angeles, CA" },
    { name: "Everson Royce Bar", address: "Los Angeles, CA" },
  ],
  "San Francisco": [
    { name: "The View Lounge", address: "Marriott Marquis, San Francisco, CA" },
    { name: "Li Po Cocktail Lounge", address: "Chinatown, San Francisco, CA" },
    { name: "Smuggler's Cove", address: "650 Gough St, San Francisco, CA 94102" },
    { name: "Vesuvio Café", address: "San Francisco, CA" },
    { name: "True Laurel", address: "San Francisco, CA" },
    { name: "Bar Sprezzatura", address: "San Francisco, CA" },
    { name: "The Saloon", address: "San Francisco, CA" },
  ],
  "Sacramento": [
    { name: "The Snug", address: "Sacramento, CA" },
    { name: "Shady Lady Saloon", address: "1409 R St, Sacramento, CA 95811" },
    { name: "Tack Room", address: "1624 J St, Sacramento, CA" },
    { name: "Flamingo House Social Club", address: "2319 K St, Sacramento, CA 95816" },
    { name: "Dive Bar", address: "Sacramento, CA" },
    { name: "The Jungle Bird", address: "Sacramento, CA" },
    { name: "Paradise Lounge", address: "Sacramento, CA" },
  ],
  "New York City": [
    { name: "Superbueno", address: "East Village, NYC" },
    { name: "Dante", address: "New York, NY" },
    { name: "Katana Kitten", address: "New York, NY" },
    { name: "Double Chicken Please", address: "New York, NY" },
    { name: "The Dead Rabbit Grocery & Grog", address: "New York, NY" },
    { name: "Employees Only", address: "New York, NY" },
    { name: "Attaboy", address: "New York, NY" },
  ],
  "San Diego": [
    { name: "Polite Provisions", address: "San Diego, CA" },
    { name: "False Idol", address: "San Diego, CA" },
    { name: "The Lafayette Hotel & Club", address: "San Diego, CA" },
    { name: "Lou Lou's", address: "San Diego, CA" },
    { name: "Young Blood", address: "San Diego, CA" },
    { name: "Realm of the 52 Remedies", address: "San Diego, CA" },
    { name: "You and Yours", address: "San Diego, CA" },
  ],
  "Austin": [
    { name: "Seven Grand", address: "Austin, TX" },
    { name: "The White Horse", address: "Austin, TX" },
    { name: "Midnight Cowboy", address: "Austin, TX" },
    { name: "Watertrade", address: "Austin, TX" },
    { name: "Garage", address: "Austin, TX" },
    { name: "Nickel City", address: "Austin, TX" },
    { name: "Swift's Attic", address: "Austin, TX" },
  ],
  "Chicago": [
    { name: "Kumiko", address: "Chicago, IL" },
    { name: "The Meadowlark", address: "Chicago, IL" },
    { name: "Best Intentions", address: "Chicago, IL" },
    { name: "Tre Dita", address: "Chicago, IL" },
    { name: "Queen Mary", address: "Chicago, IL" },
    { name: "Vol. 39", address: "Chicago, IL" },
    { name: "Bad Hunter", address: "Chicago, IL" },
  ],
};

/**
 * Get today's bar for a specific city
 * Rotates through the bars list based on the day of the year
 */
export function getTodaysBar(city: string): Bar | null {
  const bars = CITY_BARS[city];
  if (!bars || bars.length === 0) {
    return null;
  }
  
  // Calculate day of year to determine which bar to show
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Rotate through bars based on day of year
  const barIndex = dayOfYear % bars.length;
  return bars[barIndex];
}

/**
 * Get the weekly brunch venue for a specific city
 * Rotates through 3 venues weekly, cycling each month
 */
export function getWeeklyBrunchVenue(city: string): BrunchVenue | null {
  const venues = CITY_BRUNCH_VENUES[city];
  if (!venues || venues.length === 0) {
    return null;
  }
  
  // Calculate which week of the month (0, 1, 2, 3, 4)
  const now = new Date();
  const dayOfMonth = now.getDate();
  const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);
  
  // Rotate through venues based on week of month (modulo 3 for 3 venues)
  const venueIndex = weekOfMonth % venues.length;
  return venues[venueIndex];
}

/**
 * Find the nearest city that has brunch venues defined
 */
function findNearestCityWithBrunchVenues(city: string): string | null {
  const cityData = SHAKE_CITIES.find(c => c.name === city);
  if (!cityData) return null;
  
  const citiesWithBrunchVenues = Object.keys(CITY_BRUNCH_VENUES);
  let nearestCity: string | null = null;
  let minDistance = Infinity;
  
  for (const brunchCity of citiesWithBrunchVenues) {
    const brunchCityData = SHAKE_CITIES.find(c => c.name === brunchCity);
    if (!brunchCityData) continue;
    
    const distance = getDistanceFromLatLng(
      cityData.lat, cityData.lng,
      brunchCityData.lat, brunchCityData.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = brunchCity;
    }
  }
  
  return nearestCity;
}

import { SHAKE_CITIES, getDistanceFromLatLng } from "./cities";

/**
 * Find the nearest city that has a venue defined
 */
function findNearestCityWithVenue(city: string): string | null {
  const cityData = SHAKE_CITIES.find(c => c.name === city);
  if (!cityData) return null;
  
  const citiesWithVenues = Object.keys(CITY_VENUES);
  let nearestCity: string | null = null;
  let minDistance = Infinity;
  
  for (const venueCity of citiesWithVenues) {
    const venueCityData = SHAKE_CITIES.find(c => c.name === venueCity);
    if (!venueCityData) continue;
    
    const distance = getDistanceFromLatLng(
      cityData.lat, cityData.lng,
      venueCityData.lat, venueCityData.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = venueCity;
    }
  }
  
  return nearestCity;
}

/**
 * Find the nearest city that has bars defined
 */
function findNearestCityWithBars(city: string): string | null {
  const cityData = SHAKE_CITIES.find(c => c.name === city);
  if (!cityData) return null;
  
  const citiesWithBars = Object.keys(CITY_BARS);
  let nearestCity: string | null = null;
  let minDistance = Infinity;
  
  for (const barCity of citiesWithBars) {
    const barCityData = SHAKE_CITIES.find(c => c.name === barCity);
    if (!barCityData) continue;
    
    const distance = getDistanceFromLatLng(
      cityData.lat, cityData.lng,
      barCityData.lat, barCityData.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = barCity;
    }
  }
  
  return nearestCity;
}

/**
 * Get the venue location string for an activity
 * For lunch and dinner: returns venue name and address if available (with proximity fallback)
 * For drinks: returns today's rotating bar (with proximity fallback)
 * For hike: returns "TBD - Vote in chat!"
 */
export function getActivityLocation(activityType: string, city: string): string {
  // Lunch and dinner have pre-set venues
  if (activityType === "lunch" || activityType === "dinner") {
    let venue = CITY_VENUES[city];
    let usedCity = city;
    
    // If no venue for this city, find the nearest city with a venue
    if (!venue) {
      const nearestCity = findNearestCityWithVenue(city);
      if (nearestCity) {
        venue = CITY_VENUES[nearestCity];
        usedCity = nearestCity;
      }
    }
    
    if (venue) {
      return `${venue.name}, ${venue.address}`;
    }
    return "TBD - Vote in chat!";
  }
  
  // Brunch has weekly rotating venues
  if (activityType === "brunch") {
    let brunchVenue = getWeeklyBrunchVenue(city);
    
    // If no brunch venue for this city, find the nearest city with brunch venues
    if (!brunchVenue) {
      const nearestCity = findNearestCityWithBrunchVenues(city);
      if (nearestCity) {
        brunchVenue = getWeeklyBrunchVenue(nearestCity);
      }
    }
    
    if (brunchVenue) {
      return `${brunchVenue.name} – ${brunchVenue.description}`;
    }
    return "TBD - Vote in chat!";
  }
  
  // Drinks have rotating bars
  if (activityType === "drinks") {
    let bar = getTodaysBar(city);
    
    // If no bar for this city, find the nearest city with bars
    if (!bar) {
      const nearestCity = findNearestCityWithBars(city);
      if (nearestCity) {
        bar = getTodaysBar(nearestCity);
      }
    }
    
    if (bar) {
      return `${bar.name}, ${bar.address}`;
    }
    return "TBD - Vote in chat!";
  }
  
  // Hike always shows vote message
  return "TBD - Vote in chat!";
}

/**
 * Get a Google Maps URL for the venue
 * Returns null if no venue is available for the activity/city
 */
export function getVenueMapsUrl(activityType: string, city: string): string | null {
  if (activityType === "lunch" || activityType === "dinner") {
    let venue = CITY_VENUES[city];
    
    // If no venue for this city, find the nearest city with a venue
    if (!venue) {
      const nearestCity = findNearestCityWithVenue(city);
      if (nearestCity) {
        venue = CITY_VENUES[nearestCity];
      }
    }
    
    if (!venue) {
      return null;
    }
    const query = encodeURIComponent(`${venue.name}, ${venue.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  // Brunch venues
  if (activityType === "brunch") {
    let brunchVenue = getWeeklyBrunchVenue(city);
    
    // If no brunch venue for this city, find the nearest city with brunch venues
    if (!brunchVenue) {
      const nearestCity = findNearestCityWithBrunchVenues(city);
      if (nearestCity) {
        brunchVenue = getWeeklyBrunchVenue(nearestCity);
      }
    }
    
    if (!brunchVenue) {
      return null;
    }
    const query = encodeURIComponent(`${brunchVenue.name}, ${city}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  if (activityType === "drinks") {
    let bar = getTodaysBar(city);
    
    // If no bar for this city, find the nearest city with bars
    if (!bar) {
      const nearestCity = findNearestCityWithBars(city);
      if (nearestCity) {
        bar = getTodaysBar(nearestCity);
      }
    }
    
    if (!bar) {
      return null;
    }
    const query = encodeURIComponent(`${bar.name}, ${bar.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  return null;
}
