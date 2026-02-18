const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sagielka/uback-exports/main';

interface UspotItem {
  sku: string;
  desc: string;
}

interface UchamfItem {
  [key: string]: string;
}

// Try multiple possible paths for the JSON files
const USPOT_PATHS = [
  '/generated_txt/uspot-inserts.json',
  '/uspot-inserts.json',
  '/data/uspot-inserts.json',
];

const UCHAMF_PATHS = [
  '/generated_txt/uchamf-inserts.json',
  '/uchamf-inserts.json',
  '/data/uchamf-inserts.json',
];

async function fetchWithFallbackPaths(basePaths: string[]): Promise<Response | null> {
  for (const path of basePaths) {
    try {
      const response = await fetch(`${GITHUB_RAW_BASE}${path}`);
      if (response.ok) {
        return response;
      }
      // Consume the body to avoid resource leaks
      await response.text();
    } catch {
      // Continue to next path
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Fetching catalog data from GitHub...');
    
    // Try to fetch both files with fallback paths
    const [uspotResponse, uchamfResponse] = await Promise.all([
      fetchWithFallbackPaths(USPOT_PATHS),
      fetchWithFallbackPaths(UCHAMF_PATHS),
    ]);

    const uspotData: UspotItem[] = uspotResponse ? await uspotResponse.json() : [];
    const uchamfData: UchamfItem[] = uchamfResponse ? await uchamfResponse.json() : [];

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
        usedFallback: uspotData.length === 0 && uchamfData.length === 0,
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
    
    // Return empty data instead of 500 so the client uses local fallback
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