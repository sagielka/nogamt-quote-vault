import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getQuoteDatePrefix(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return `MT${day}${month}${year}`;
}

function cleanCustomerName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim().toUpperCase();
}

function getNextRunDate(frequency: string, from: Date): string {
  const next = new Date(from);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();

    // Fetch all active recurring quotations that are due
    const { data: dueRecurring, error: fetchError } = await supabase
      .from("recurring_quotations")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString());

    if (fetchError) {
      console.error("Error fetching recurring quotations:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueRecurring || dueRecurring.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring quotations due", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; quoteNumber: string; success: boolean; error?: string }[] = [];

    for (const rec of dueRecurring) {
      try {
        const datePrefix = getQuoteDatePrefix();
        const customerName = cleanCustomerName(rec.client_name);

        // Find existing quote numbers for this customer today to determine index
        const pattern = `${datePrefix}-%`;
        const { data: existingQuotes } = await supabase
          .from("quotations")
          .select("quote_number")
          .like("quote_number", pattern);

        const existingNumbers = (existingQuotes || []).map((q: { quote_number: string }) => q.quote_number);
        
        // Find max index for this customer
        const escapedName = customerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`^${datePrefix}-(\\d{2})-${escapedName}`, "i");
        let maxIndex = 0;
        for (const qn of existingNumbers) {
          const match = qn.match(regex);
          if (match) {
            const idx = parseInt(match[1], 10);
            if (idx > maxIndex) maxIndex = idx;
          }
        }
        const nextIndex = String(maxIndex + 1).padStart(2, "0");
        const quoteNumber = customerName
          ? `${datePrefix}-${nextIndex}-${customerName}`
          : `${datePrefix}-${nextIndex}`;

        // Set valid_until to 30 days from now
        const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Create the quotation
        const { error: insertError } = await supabase
          .from("quotations")
          .insert({
            user_id: rec.user_id,
            quote_number: quoteNumber,
            client_name: rec.client_name,
            client_email: rec.client_email,
            client_address: rec.client_address,
            items: rec.template_items,
            currency: rec.currency,
            tax_rate: rec.tax_rate,
            discount_type: rec.discount_type,
            discount_value: rec.discount_value,
            notes: rec.notes,
            status: "sent",
            valid_until: validUntil.toISOString(),
          });

        if (insertError) {
          console.error(`Failed to create quotation for recurring ${rec.id}:`, insertError);
          results.push({ id: rec.id, quoteNumber, success: false, error: insertError.message });
          continue;
        }

        // Update recurring: set last_run_at and calculate next_run_at
        const nextRunAt = getNextRunDate(rec.frequency, now);
        await supabase
          .from("recurring_quotations")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRunAt,
          })
          .eq("id", rec.id);

        // Log activity
        await supabase.from("activity_log").insert({
          user_id: rec.user_id,
          action: "auto_created",
          entity_type: "quotation",
          entity_label: quoteNumber,
          details: { source: "recurring", recurring_id: rec.id, frequency: rec.frequency },
        });

        results.push({ id: rec.id, quoteNumber, success: true });
        console.log(`Created quotation ${quoteNumber} from recurring ${rec.id}`);
      } catch (err) {
        console.error(`Error processing recurring ${rec.id}:`, err);
        results.push({ id: rec.id, quoteNumber: "", success: false, error: String(err) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({
        message: `Processed ${dueRecurring.length} recurring quotations, ${successCount} succeeded`,
        processed: dueRecurring.length,
        succeeded: successCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
