// Venue data for lunch and dinner activities
// For drinks and hike, we keep "TBD - Vote in chat!"

export interface Venue {
  name: string;
  address: string;
}

export interface Bar {
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
 * Get the venue location string for an activity
 * For lunch and dinner: returns venue name and address if available
 * For drinks: returns today's rotating bar
 * For hike: returns "TBD - Vote in chat!"
 */
export function getActivityLocation(activityType: string, city: string): string {
  // Lunch and dinner have pre-set venues
  if (activityType === "lunch" || activityType === "dinner") {
    const venue = CITY_VENUES[city];
    if (venue) {
      return `${venue.name}, ${venue.address}`;
    }
    return "TBD - Vote in chat!";
  }
  
  // Drinks have rotating bars
  if (activityType === "drinks") {
    const bar = getTodaysBar(city);
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
    const venue = CITY_VENUES[city];
    if (!venue) {
      return null;
    }
    const query = encodeURIComponent(`${venue.name}, ${venue.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  if (activityType === "drinks") {
    const bar = getTodaysBar(city);
    if (!bar) {
      return null;
    }
    const query = encodeURIComponent(`${bar.name}, ${bar.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  return null;
}
