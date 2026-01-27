import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address || typeof address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      console.error('[GEOCODE] Missing MAPBOX_PUBLIC_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Geocoding service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encodedAddress = encodeURIComponent(address);
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;
    
    console.log('[GEOCODE] Fetching coordinates for:', address);
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.log('[GEOCODE] No results found for address');
      return new Response(
        JSON.stringify({ error: 'Address not found', latitude: null, longitude: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [longitude, latitude] = data.features[0].center;
    const placeName = data.features[0].place_name;
    
    console.log('[GEOCODE] Found coordinates:', { latitude, longitude, placeName });

    return new Response(
      JSON.stringify({ 
        latitude, 
        longitude,
        formattedAddress: placeName,
        success: true 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to geocode address' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
