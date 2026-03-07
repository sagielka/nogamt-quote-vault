import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get("t");

    if (trackingId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Update tracking record: set read_at on first open, increment read_count
      const { data: existing } = await supabase
        .from("email_tracking")
        .select("id, read_at, read_count")
        .eq("tracking_id", trackingId)
        .maybeSingle();

      if (existing) {
        const updates: any = { read_count: (existing.read_count || 0) + 1 };
        if (!existing.read_at) {
          updates.read_at = new Date().toISOString();
        }
        await supabase
          .from("email_tracking")
          .update(updates)
          .eq("id", existing.id);
      }
    }
  } catch (err) {
    console.error("Tracking error:", err);
  }

  // Always return the pixel regardless of errors
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders,
    },
  });
};

Deno.serve(handler);
