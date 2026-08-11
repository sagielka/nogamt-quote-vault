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
      .select("id, user_id, quote_number, client_name, client_email, valid_until, status, currency, items, created_at")
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

    // Resolve owner emails
    const ownerEmail = new Map<string, string>();
    try {
      let page = 1;
      while (page <= 10) {
        const { data: usersPage } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const list = usersPage?.users ?? [];
        for (const u of list) if (u.email) ownerEmail.set(u.id, u.email);
        if (list.length < 200) break;
        page++;
      }
    } catch (e) {
      console.error("listUsers error:", e);
    }

    const ownerLabel = (userId: string | null) => {
      const email = userId ? ownerEmail.get(userId) : undefined;
      if (!email) return "Unassigned";
      const prefix = email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    };

    const row = (q: any, withOwner: boolean) => {
      const link = `${APP_URL}/#/?highlight=${q.id}`;
      return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <a href="${link}" style="color:#0891b2;text-decoration:none;font-weight:500;">${q.quote_number}</a>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${q.client_name}</td>
            ${withOwner ? `<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>${ownerLabel(q.user_id)}</strong></td>` : ""}
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${new Date(q.valid_until).toLocaleDateString()}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <a href="${link}" style="display:inline-block;padding:4px 12px;background:#0891b2;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;">Review</a>
            </td>
          </tr>`;
    };

    const buildHtml = (list: any[], withOwner: boolean, greeting: string) => `
      <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;">
        <h2 style="color:#ff9004;">Expired Quotations Closed</h2>
        <p>${greeting}</p>
        <p><strong>${list.length}</strong> quotation${list.length > 1 ? "s" : ""} passed their validity date and were moved to <strong>Done - No Order</strong>.</p>
        <p>If any of these were actually ordered, open them and mark them as <strong>Order Received</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Quote #</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Client</th>
              ${withOwner ? `<th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Responsible</th>` : ""}
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Valid Until</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Action</th>
            </tr>
          </thead>
          <tbody>${list.map((q) => row(q, withOwner)).join("")}</tbody>
        </table>
        <p style="margin-top:30px;">Best regards,<br><strong>Noga Quote System</strong></p>
      </div>`;

    const sendMail = async (to: string, subject: string, htmlContent: string) => {
      const res = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: { name: "Noga Quote System", email: "quotes@noga-mt.com" },
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });
      if (!res.ok) console.error(`Brevo error for ${to}:`, await res.text());
      return res.ok;
    };

    // Group by responsible user
    const groups = new Map<string, any[]>();
    for (const q of expired) {
      const key = q.user_id ?? "unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(q);
    }

    let ownerNotified = 0;
    for (const [userId, list] of groups) {
      const email = ownerEmail.get(userId);
      if (!email || email.toLowerCase() === NOTIFY_EMAIL.toLowerCase()) continue;
      const ok = await sendMail(
        email,
        `${list.length} of your quotation${list.length > 1 ? "s" : ""} expired - moved to Done - No Order`,
        buildHtml(list, false, `Hi ${ownerLabel(userId)},`)
      );
      if (ok) ownerNotified++;
    }

    // Admin summary with responsible user column
    const adminOk = await sendMail(
      NOTIFY_EMAIL,
      `${expired.length} Expired Quotation${expired.length > 1 ? "s" : ""} moved to Done - No Order`,
      buildHtml(expired, true, "Full summary across all users:")
    );

    return new Response(JSON.stringify({ expired: expired.length, ownerNotified, adminNotified: adminOk }), {
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
