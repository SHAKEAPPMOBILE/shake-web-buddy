import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResult {
  venueId: string;
  venueName: string;
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
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

    // Fetch venues without coordinates
    const { data: venues, error: fetchError } = await supabase
      .from('venues')
      .select('id, name, address, city, latitude, longitude')
      .or('latitude.is.null,longitude.is.null')
      .eq('is_active', true);

    if (fetchError) {
      console.error('[BULK-GEOCODE] Error fetching venues:', fetchError);
      throw fetchError;
    }

    if (!venues || venues.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All venues already have coordinates', processed: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BULK-GEOCODE] Processing ${venues.length} venues without coordinates`);

    const results: GeocodeResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const venue of venues) {
      // Add delay to avoid rate limiting (Mapbox allows 600 requests/minute)
      await new Promise(resolve => setTimeout(resolve, 150));

      const fullAddress = `${venue.name}, ${venue.address}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;

      try {
        console.log(`[BULK-GEOCODE] Geocoding: ${venue.name} (${venue.city})`);
        
        const response = await fetch(geocodeUrl);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const [longitude, latitude] = data.features[0].center;

          // Update venue with coordinates
          const { error: updateError } = await supabase
            .from('venues')
            .update({ latitude, longitude })
            .eq('id', venue.id);

          if (updateError) {
            console.error(`[BULK-GEOCODE] Error updating ${venue.name}:`, updateError);
            results.push({
              venueId: venue.id,
              venueName: venue.name,
              success: false,
              error: 'Database update failed'
            });
            failCount++;
          } else {
            console.log(`[BULK-GEOCODE] ✓ ${venue.name}: ${latitude}, ${longitude}`);
            results.push({
              venueId: venue.id,
              venueName: venue.name,
              success: true,
              latitude,
              longitude
            });
            successCount++;
          }
        } else {
          console.log(`[BULK-GEOCODE] ✗ No results for: ${venue.name}`);
          results.push({
            venueId: venue.id,
            venueName: venue.name,
            success: false,
            error: 'Address not found'
          });
          failCount++;
        }
      } catch (error) {
        console.error(`[BULK-GEOCODE] Error geocoding ${venue.name}:`, error);
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          success: false,
          error: String(error)
        });
        failCount++;
      }
    }

    console.log(`[BULK-GEOCODE] Complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        message: `Geocoded ${successCount} venues, ${failCount} failed`,
        processed: venues.length,
        success: successCount,
        failed: failCount,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[BULK-GEOCODE] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to bulk geocode venues' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
