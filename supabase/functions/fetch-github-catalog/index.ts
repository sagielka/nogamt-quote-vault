const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sagielka/uback-exports/main/ERP_Exports/U-BACKexportFiles';

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
    
    const [uspotResponse, uchamfResponse] = await Promise.all([
      fetch(`${GITHUB_RAW_BASE}/uspot-inserts.json`),
      fetch(`${GITHUB_RAW_BASE}/uchamf-inserts.json`),
    ]);

    let uspotData: UspotItem[] = [];
    let uchamfData: UchamfItem[] = [];

    if (uspotResponse.ok) {
      uspotData = await uspotResponse.json();
    } else {
      console.warn(`uspot-inserts.json returned ${uspotResponse.status}`);
      await uspotResponse.text();
    }

    if (uchamfResponse.ok) {
      uchamfData = await uchamfResponse.json();
    } else {
      console.warn(`uchamf-inserts.json returned ${uchamfResponse.status}`);
      await uchamfResponse.text();
    }

    if (uspotData.length === 0 && uchamfData.length === 0) {
      console.warn('No catalog data found on GitHub. Client should use local fallback data.');
    } else {
      console.log(`Fetched ${uspotData.length} uspot items and ${uchamfData.length} uchamf items`);
    }

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
          'Cache-Control': 'public, max-age=300',
        } 
      }
    );
  } catch (error) {
    console.error('Error fetching catalog:', error);
    
    return new Response(
      JSON.stringify({
        success: true,
        uspot: [],
        uchamf: [],
        fetchedAt: new Date().toISOString(),
        usedFallback: true,
        warning: error instanceof Error ? error.message : 'Failed to fetch catalog data',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});