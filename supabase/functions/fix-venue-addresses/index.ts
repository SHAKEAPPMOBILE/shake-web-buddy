import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CITY_COUNTRY_MAP: Record<string, string> = {
  "Lisbon": "PT", "Porto": "PT",
  "Madrid": "ES", "Barcelona": "ES",
  "Rome": "IT", "Milan": "IT", "Florence": "IT",
  "Paris": "FR", "Lyon": "FR",
  "Berlin": "DE", "Munich": "DE", "Hamburg": "DE",
  "London": "GB", "Manchester": "GB", "Edinburgh": "GB", "Birmingham": "GB", "Liverpool": "GB", "Bristol": "GB",
  "Dublin": "IE", "Cork": "IE",
  "Zurich": "CH", "Geneva": "CH", "Basel": "CH",
  "Vienna": "AT", "Innsbruck": "AT",
  "Amsterdam": "NL",
  "Brussels": "BE",
  "Warsaw": "PL",
  "Bucharest": "RO",
  "Belgrade": "RS",
  "Zagreb": "HR",
  "Athens": "GR",
  "Helsinki": "FI",
  "Bratislava": "SK",
  "Copenhagen": "DK",
  "Stockholm": "SE",
  "Oslo": "NO",
  "Prague": "CZ",
  "Budapest": "HU",
  "Tel Aviv": "IL",
  "Dubai": "AE",
  "New York City": "US", "San Francisco": "US", "Los Angeles": "US", "San Diego": "US",
  "Austin": "US", "Miami": "US", "Boston": "US", "Dallas": "US", "Chicago": "US", "Sacramento": "US",
  "Medellín": "CO", "Bogotá": "CO",
  "São Paulo": "BR", "Rio de Janeiro": "BR",
  "Mexico City": "MX",
};

const BAD_ADDRESS_PATTERNS = [
  /^(iconic|social|instagram|stylish|trendy|hidden|classic|popular|famous|best|top|great|cool|nice|modern|cozy|craft|artisan|award|premium|upscale|plant-based|organic|vegan|healthy|rooftop|garden|creative|local|community|unique|buzzing|lively|chic|elegant|charming|rustic|eclectic|vibrant|authentic|traditional|innovative|contemporary|underground|secret|exclusive|boutique|curated|seasonal|sustainable|farm|fresh|raw|clean|scalable|consistent)/i,
  /brunch|cocktail|spot|hub|favorite|bar scene|speakeasy|mixology|wine bar|beer|food|dining|restaurant|café scene|coffee|crowd|setting|classics|bakery/i,
];

function isBadAddress(address: string, city: string): boolean {
  const trimmed = address.trim();
  if (trimmed.toLowerCase() === city.toLowerCase()) return true;
  if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/i.test(trimmed)) return true; // "Austin, TX"
  if (/^[A-Za-z\s]+,\s*[A-Za-z\s]+$/i.test(trimmed) && trimmed.length < 30) return true; // "Amsterdam, Netherlands"
  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(trimmed)) return true; // Just city name
  return BAD_ADDRESS_PATTERNS.some(pattern => pattern.test(trimmed));
}

async function lookupAddressesWithAI(venues: Array<{ name: string; city: string }>): Promise<Record<string, string>> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const venueList = venues.map((v, i) => `${i + 1}. "${v.name}" in ${v.city}`).join('\n');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a venue address lookup assistant. Given a list of restaurant/bar/café names and their cities, return the real street address for each one. Return ONLY a JSON object mapping the venue name to its street address (street name and number, postal code, city). If you don't know the exact address, give your best approximation of the street address based on the neighborhood/area the venue is known to be in. Format: {"Venue Name": "Street Address, Postal Code, City, Country"}. No markdown, no explanation, just the JSON object.`
        },
        {
          role: 'user',
          content: `Find the real street addresses for these venues:\n${venueList}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse AI response: ${content.substring(0, 200)}`);
  
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');

    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'MAPBOX_PUBLIC_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { dryRun = false, limit = 20, city: filterCity = null } = await req.json().catch(() => ({}));

    let query = supabase
      .from('venues')
      .select('id, name, address, city, latitude, longitude')
      .eq('is_active', true);
    if (filterCity) query = query.eq('city', filterCity);

    const { data: venues, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!venues?.length) {
      return new Response(JSON.stringify({ message: 'No venues found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allBadVenues = venues.filter(v => isBadAddress(v.address, v.city));
    const badVenues = allBadVenues.slice(0, limit);
    console.log(`[FIX-VENUES] ${allBadVenues.length} bad addresses total, processing ${badVenues.length}`);

    if (!badVenues.length) {
      return new Response(JSON.stringify({ message: 'All venues have valid addresses', total: venues.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 1: Use AI to look up real addresses in batch
    console.log(`[FIX-VENUES] Looking up addresses with AI...`);
    let addressMap: Record<string, string>;
    try {
      addressMap = await lookupAddressesWithAI(badVenues.map(v => ({ name: v.name, city: v.city })));
      console.log(`[FIX-VENUES] AI returned ${Object.keys(addressMap).length} addresses`);
    } catch (err) {
      console.error(`[FIX-VENUES] AI lookup failed:`, err);
      return new Response(JSON.stringify({ error: `AI lookup failed: ${err}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 2: Geocode each AI-provided address with Mapbox
    const results: Array<{
      id: string; name: string; city: string;
      oldAddress: string; aiAddress: string | null; newAddress: string | null;
      lat: number | null; lng: number | null;
      success: boolean; error?: string;
    }> = [];
    let successCount = 0, failCount = 0;

    for (const venue of badVenues) {
      const aiAddress = addressMap[venue.name];
      if (!aiAddress) {
        console.log(`[FIX-VENUES] ✗ AI didn't return address for: ${venue.name}`);
        results.push({ id: venue.id, name: venue.name, city: venue.city, oldAddress: venue.address, aiAddress: null, newAddress: null, lat: null, lng: null, success: false, error: 'AI did not return address' });
        failCount++;
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      const countryCode = CITY_COUNTRY_MAP[venue.city];
      const encodedAddr = encodeURIComponent(aiAddress);
      let geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddr}.json?access_token=${mapboxToken}&limit=1`;
      if (countryCode) geocodeUrl += `&country=${countryCode}`;

      try {
        const response = await fetch(geocodeUrl);
        const data = await response.json();

        if (data.features?.length > 0) {
          const [longitude, latitude] = data.features[0].center;

          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('venues')
              .update({ address: aiAddress, latitude, longitude })
              .eq('id', venue.id);
            if (updateError) {
              results.push({ id: venue.id, name: venue.name, city: venue.city, oldAddress: venue.address, aiAddress, newAddress: null, lat: latitude, lng: longitude, success: false, error: 'DB update failed' });
              failCount++;
              continue;
            }
          }

          console.log(`[FIX-VENUES] ✓ ${venue.name}: "${aiAddress}" → (${latitude}, ${longitude})`);
          results.push({ id: venue.id, name: venue.name, city: venue.city, oldAddress: venue.address, aiAddress, newAddress: aiAddress, lat: latitude, lng: longitude, success: true });
          successCount++;
        } else {
          results.push({ id: venue.id, name: venue.name, city: venue.city, oldAddress: venue.address, aiAddress, newAddress: null, lat: null, lng: null, success: false, error: 'Geocoding failed' });
          failCount++;
        }
      } catch (error) {
        results.push({ id: venue.id, name: venue.name, city: venue.city, oldAddress: venue.address, aiAddress, newAddress: null, lat: null, lng: null, success: false, error: String(error) });
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: dryRun ? `Dry run: ${successCount} would be fixed` : `Fixed ${successCount}/${badVenues.length}`,
        dryRun, total: venues.length, badAddresses: allBadVenues.length,
        processed: badVenues.length, success: successCount, failed: failCount, results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[FIX-VENUES] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
