-- Add venues for cities that were missing drinks/brunch/lunch_dinner coverage.
-- Cities added: Panama City, Miami, Chicago, Mexico City, São Paulo, Rio de Janeiro,
--               Dubai, Tel Aviv, Cartagena, Sacramento.

INSERT INTO public.venues (city, name, address, venue_type, sort_order, is_active) VALUES

-- PANAMA CITY drinks (7)
('Panama City', 'Istmo Brew Pub', 'Casco Viejo, Panama City', 'drinks', 0, true),
('Panama City', 'La Rana Dorada', 'El Cangrejo, Panama City', 'drinks', 1, true),
('Panama City', 'Atomic Rooftop', 'Marbella, Panama City', 'drinks', 2, true),
('Panama City', 'Casa Jaguar', 'Casco Viejo, Panama City', 'drinks', 3, true),
('Panama City', 'Caneca Bar', 'San Francisco, Panama City', 'drinks', 4, true),
('Panama City', 'Salvaje', 'Zona Viva, Panama City', 'drinks', 5, true),
('Panama City', 'Hops Beer Garden', 'Obarrio, Panama City', 'drinks', 6, true),

-- PANAMA CITY brunch (3)
('Panama City', 'Fonda Lo Que Hay', 'Casco Viejo, Panama City', 'brunch', 0, true),
('Panama City', 'Greenhouse Panama', 'Marbella, Panama City', 'brunch', 1, true),
('Panama City', 'Brunch & Cake', 'San Francisco, Panama City', 'brunch', 2, true),

-- PANAMA CITY lunch_dinner (1)
('Panama City', 'Maito', 'San Francisco, Panama City', 'lunch_dinner', 0, true),

-- MIAMI drinks (7)
('Miami', 'Broken Shaker', 'Freehand Miami, Miami Beach', 'drinks', 0, true),
('Miami', 'Ball & Chain', 'Little Havana, Miami', 'drinks', 1, true),
('Miami', 'Sweet Liberty', 'Mid-Beach, Miami', 'drinks', 2, true),
('Miami', 'Bodega', 'Wynwood, Miami', 'drinks', 3, true),
('Miami', 'The Anderson', 'Upper East Side, Miami', 'drinks', 4, true),
('Miami', 'Gramps', 'Wynwood, Miami', 'drinks', 5, true),
('Miami', 'Blackbird Ordinary', 'Brickell, Miami', 'drinks', 6, true),

-- MIAMI lunch_dinner (1)
('Miami', 'Zak the Baker', 'Wynwood, Miami', 'lunch_dinner', 0, true),

-- CHICAGO brunch (3)
('Chicago', 'The Publican', 'West Loop, Chicago', 'brunch', 0, true),
('Chicago', 'Wildberry Pancakes', 'Loop, Chicago', 'brunch', 1, true),
('Chicago', 'Little Goat', 'West Loop, Chicago', 'brunch', 2, true),

-- CHICAGO lunch_dinner (1)
('Chicago', 'Girl & The Goat', 'West Loop, Chicago', 'lunch_dinner', 0, true),

-- MEXICO CITY drinks (7)
('Mexico City', 'Limantour', 'Roma Norte, Mexico City', 'drinks', 0, true),
('Mexico City', 'Baltra Bar', 'Roma Norte, Mexico City', 'drinks', 1, true),
('Mexico City', 'Parker & Lenox', 'Polanco, Mexico City', 'drinks', 2, true),
('Mexico City', 'Xaman', 'Centro, Mexico City', 'drinks', 3, true),
('Mexico City', 'Fifty Mils', 'Juarez, Mexico City', 'drinks', 4, true),
('Mexico City', 'La Clandestina', 'Roma Norte, Mexico City', 'drinks', 5, true),
('Mexico City', 'Hanky Panky', 'Roma Norte, Mexico City', 'drinks', 6, true),

-- MEXICO CITY lunch_dinner (1)
('Mexico City', 'Pujol', 'Polanco, Mexico City', 'lunch_dinner', 0, true),

-- SAO PAULO drinks (7)
('São Paulo', 'Bar Número', 'Jardins, São Paulo', 'drinks', 0, true),
('São Paulo', 'SubAstor', 'Pinheiros, São Paulo', 'drinks', 1, true),
('São Paulo', 'Guilhotina', 'Vila Madalena, São Paulo', 'drinks', 2, true),
('São Paulo', 'Bar Brahma', 'Centro, São Paulo', 'drinks', 3, true),
('São Paulo', 'Bardot', 'Itaim Bibi, São Paulo', 'drinks', 4, true),
('São Paulo', 'Spot Bar', 'Jardins, São Paulo', 'drinks', 5, true),
('São Paulo', 'Frank Bar', 'Pinheiros, São Paulo', 'drinks', 6, true),

-- SAO PAULO lunch_dinner (1)
('São Paulo', 'A Figueira Rubaiyat', 'Jardins, São Paulo', 'lunch_dinner', 0, true),

-- RIO DE JANEIRO drinks (7)
('Rio de Janeiro', 'Bar do Mineiro', 'Santa Teresa, Rio', 'drinks', 0, true),
('Rio de Janeiro', 'Devassa', 'Leblon, Rio de Janeiro', 'drinks', 1, true),
('Rio de Janeiro', 'Academia da Cachaça', 'Leblon, Rio de Janeiro', 'drinks', 2, true),
('Rio de Janeiro', 'Belmonte', 'Flamengo, Rio de Janeiro', 'drinks', 3, true),
('Rio de Janeiro', 'Jobi', 'Leblon, Rio de Janeiro', 'drinks', 4, true),
('Rio de Janeiro', 'Baretto-Londra', 'Ipanema, Rio de Janeiro', 'drinks', 5, true),
('Rio de Janeiro', 'Empório', 'Santa Teresa, Rio de Janeiro', 'drinks', 6, true),

-- RIO DE JANEIRO lunch_dinner (1)
('Rio de Janeiro', 'Aprazível', 'Santa Teresa, Rio de Janeiro', 'lunch_dinner', 0, true),

-- DUBAI drinks (7)
('Dubai', 'Zuma', 'DIFC, Dubai', 'drinks', 0, true),
('Dubai', 'Iris', 'Meydan, Dubai', 'drinks', 1, true),
('Dubai', 'Pier 7', 'Dubai Marina', 'drinks', 2, true),
('Dubai', 'Barfly', 'Hilton Dubai Creek', 'drinks', 3, true),
('Dubai', 'Cé La Vi', 'Address Sky View, Dubai', 'drinks', 4, true),
('Dubai', 'Blue Bar', 'Novotel, Dubai', 'drinks', 5, true),
('Dubai', 'Vault', 'JW Marriott Marquis, Dubai', 'drinks', 6, true),

-- DUBAI lunch_dinner (1)
('Dubai', 'Nobu Dubai', 'Atlantis The Palm, Dubai', 'lunch_dinner', 0, true),

-- TEL AVIV drinks (7)
('Tel Aviv', 'Bellboy', 'Florentin, Tel Aviv', 'drinks', 0, true),
('Tel Aviv', 'Imperial Craft', 'HaYarkon, Tel Aviv', 'drinks', 1, true),
('Tel Aviv', 'Pasaz', 'Rothschild Blvd, Tel Aviv', 'drinks', 2, true),
('Tel Aviv', 'Lola', 'Neve Tzedek, Tel Aviv', 'drinks', 3, true),
('Tel Aviv', 'Nordoy', 'Florentin, Tel Aviv', 'drinks', 4, true),
('Tel Aviv', 'Radio EPGB', 'Florentin, Tel Aviv', 'drinks', 5, true),
('Tel Aviv', 'Kuli Alma', 'Florentin, Tel Aviv', 'drinks', 6, true),

-- TEL AVIV lunch_dinner (1)
('Tel Aviv', 'Abu Hassan', 'Old Jaffa, Tel Aviv', 'lunch_dinner', 0, true),

-- CARTAGENA drinks (7)
('Cartagena', 'Café del Mar', 'Ciudad Amurallada, Cartagena', 'drinks', 0, true),
('Cartagena', 'Alquímico', 'Ciudad Amurallada, Cartagena', 'drinks', 1, true),
('Cartagena', 'El Barón', 'Getsemaní, Cartagena', 'drinks', 2, true),
('Cartagena', 'Doña Manuela', 'Ciudad Amurallada, Cartagena', 'drinks', 3, true),
('Cartagena', 'La Movida', 'Bocagrande, Cartagena', 'drinks', 4, true),
('Cartagena', 'Demente', 'Getsemaní, Cartagena', 'drinks', 5, true),
('Cartagena', 'Quiebracanto', 'Getsemaní, Cartagena', 'drinks', 6, true),

-- CARTAGENA brunch (3)
('Cartagena', 'Carmen Restaurant', 'Ciudad Amurallada, Cartagena', 'brunch', 0, true),
('Cartagena', 'La Vitrola', 'Ciudad Amurallada, Cartagena', 'brunch', 1, true),
('Cartagena', 'El Santísimo', 'Ciudad Amurallada, Cartagena', 'brunch', 2, true),

-- SACRAMENTO brunch (3)
('Sacramento', 'The Porch', 'Midtown, Sacramento', 'brunch', 0, true),
('Sacramento', 'Magpie Cafe', 'Midtown, Sacramento', 'brunch', 1, true),
('Sacramento', 'Bacon & Butter', 'Land Park, Sacramento', 'brunch', 2, true),

-- SACRAMENTO lunch_dinner (1)
('Sacramento', 'The Kitchen', 'East Sacramento', 'lunch_dinner', 0, true)

ON CONFLICT (city, name, venue_type) DO NOTHING;
