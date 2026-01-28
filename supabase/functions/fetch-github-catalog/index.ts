const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sagielka/uback-exports/main/generated_txt';

interface UspotItem {
  sku: string;
  desc: string;
}

interface UchamfItem {
  [key: string]: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Fetching catalog data from GitHub...');
    
    // Fetch both files in parallel
    const [uspotResponse, uchamfResponse] = await Promise.all([
      fetch(`${GITHUB_RAW_BASE}/uspot-inserts.json`),
      fetch(`${GITHUB_RAW_BASE}/uchamf-inserts.json`),
    ]);

    if (!uspotResponse.ok) {
      console.error('Failed to fetch uspot-inserts.json:', uspotResponse.status);
      throw new Error(`Failed to fetch uspot-inserts.json: ${uspotResponse.status}`);
    }

    if (!uchamfResponse.ok) {
      console.error('Failed to fetch uchamf-inserts.json:', uchamfResponse.status);
      throw new Error(`Failed to fetch uchamf-inserts.json: ${uchamfResponse.status}`);
    }

    const uspotData: UspotItem[] = await uspotResponse.json();
    const uchamfData: UchamfItem[] = await uchamfResponse.json();

    console.log(`Fetched ${uspotData.length} uspot items and ${uchamfData.length} uchamf items`);

    return new Response(
      JSON.stringify({
        success: true,
        uspot: uspotData,
        uchamf: uchamfData,
        fetchedAt: new Date().toISOString(),
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        } 
      }
    );
  } catch (error) {
    console.error('Error fetching catalog:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch catalog data',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
