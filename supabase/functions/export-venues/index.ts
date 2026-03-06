import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('city', { ascending: true })
      .order('venue_type', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Build CSV
    const headers = ['city', 'name', 'address', 'venue_type', 'latitude', 'longitude', 'sort_order', 'is_active', 'id'];
    const csvRows = [headers.join(',')];
    
    for (const v of data) {
      const row = [
        `"${(v.city || '').replace(/"/g, '""')}"`,
        `"${(v.name || '').replace(/"/g, '""')}"`,
        `"${(v.address || '').replace(/"/g, '""')}"`,
        v.venue_type,
        v.latitude ?? '',
        v.longitude ?? '',
        v.sort_order,
        v.is_active,
        v.id,
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="venues-export.csv"',
      },
    });
  } catch (error) {
    console.error('[EXPORT-VENUES] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export venues' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
