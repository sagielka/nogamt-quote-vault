import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const NOTIFY_EMAIL = "sagi@noga.com";
const APP_URL = "https://quote.noga-mt.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();

    // Expired quotations that were never accepted / closed
    const { data: expired, error: fetchError } = await supabase
      .from("quotations")
      .select("id, quote_number, client_name, client_email, valid_until, status, currency, items, created_at")
      .lt("valid_until", now.toISOString())
      .or("status.is.null,status.eq.draft,status.eq.sent");

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ids = expired.map((q) => q.id);
    const { error: updateError } = await supabase
      .from("quotations")
      .update({ status: "finished" })
      .in("id", ids);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rows = expired
      .map((q) => {
        const link = `${APP_URL}/#/?highlight=${q.id}`;
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <a href="${link}" style="color:#0891b2;text-decoration:none;font-weight:500;">${q.quote_number}</a>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${q.client_name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${new Date(q.valid_until).toLocaleDateString()}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <a href="${link}" style="display:inline-block;padding:4px 12px;background:#0891b2;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;">Review</a>
            </td>
          </tr>`;
      })
      .join("");

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h2 style="color:#ff9004;">Expired Quotations Closed</h2>
        <p><strong>${expired.length}</strong> quotation${expired.length > 1 ? "s" : ""} passed their validity date and were moved to <strong>Done - No Order</strong>.</p>
        <p>If any of these were actually ordered, open them and mark them as <strong>Order Received</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Quote #</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Client</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Valid Until</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:30px;">Best regards,<br><strong>Noga Quote System</strong></p>
      </div>`;

    const brevoResponse = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: { name: "Noga Quote System", email: "quotes@noga-mt.com" },
        to: [{ email: NOTIFY_EMAIL }],
        subject: `${expired.length} Expired Quotation${expired.length > 1 ? "s" : ""} moved to Done - No Order`,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      console.error("Brevo error:", await brevoResponse.text());
    }

    return new Response(JSON.stringify({ expired: expired.length, notified: brevoResponse.ok }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("expire-quotations error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
