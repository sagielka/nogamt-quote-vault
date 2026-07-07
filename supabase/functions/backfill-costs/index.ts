// One-off backfill: fills missing costPrice on line items of existing quotations
// and archived_quotations, based on the SKU cost table (USD) with currency conversion.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import costsData from "./costs.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.6, JPY: 150, CNY: 7.2,
};

const COSTS = costsData as Record<string, number>;

function convert(usd: number, currency: string): number {
  const r = RATES[currency] ?? 1;
  return Math.round(usd * r * 100) / 100;
}

async function backfillTable(supabase: any, table: string) {
  let processed = 0, updated = 0, itemsFilled = 0;
  let from = 0;
  const pageSize = 200;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, items, currency")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      processed++;
      const items = Array.isArray(row.items) ? row.items : [];
      let changed = false;
      const newItems = items.map((it: any) => {
        const sku = (it?.sku ?? "").toString().trim().toUpperCase();
        const desc = (it?.description ?? "").toString().toUpperCase();
        const currentRaw = it?.costPrice;
        const current = Number(currentRaw);
        if (Number.isFinite(current) && current > 0) return it;

        // 1) direct SKU cost
        let usd = COSTS[sku];
        let src = "direct";

        // 2) US-... custom SKUs OR description starting with US-: derive from GROUP letter (B-G) in description
        const descIsUS = desc.startsWith("US-") || desc.startsWith("US ");
        if ((!usd || usd <= 0) && (sku.startsWith("US") || descIsUS)) {
          const letters = ["B", "C", "D", "E", "F", "G"];
          let found: string | null = null;
          const parts = desc.split("-");
          if (parts.length >= 4 && parts[3].length === 1 && letters.includes(parts[3])) {
            found = parts[3];
          } else {
            for (const l of letters) {
              if (desc.includes(`-${l}-`)) { found = l; break; }
            }
          }
          if (found) { usd = COSTS[`GROUP ${found}`]; src = `GROUP ${found}`; }
        }

        if (usd && usd > 0) {
          changed = true;
          itemsFilled++;
          console.log(`fill ${sku} via ${src} -> ${usd} USD`);
          return { ...it, costPrice: convert(usd, row.currency || "USD") };
        }
        return it;
      });
      if (changed) {
        const { error: uErr } = await supabase.from(table).update({ items: newItems }).eq("id", row.id);
        if (uErr) throw uErr;
        updated++;
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { processed, updated, itemsFilled };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const q = await backfillTable(supabase, "quotations");
    const a = await backfillTable(supabase, "archived_quotations");
    return new Response(
      JSON.stringify({ ok: true, quotations: q, archived_quotations: a }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("backfill-costs failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
