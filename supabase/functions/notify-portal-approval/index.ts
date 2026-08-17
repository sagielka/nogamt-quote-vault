import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BCC_EMAIL = "sagi@noga.com";
const PORTAL_PRICES_URL = "https://quote.noga-mt.com/#/prices";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");


Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await anon.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isStaff = (roles || []).some((r: any) => ["admin", "user"].includes(r.role));
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const accountId = typeof body?.accountId === "string" ? body.accountId : null;
    const emailInput = typeof body?.email === "string" ? body.email.trim() : null;
    if (!accountId && !emailInput) return json({ error: "accountId or email is required" }, 400);

    let query = admin
      .from("customer_accounts")
      .select("email, company_name, contact_name, status, is_account_admin");
    query = accountId ? query.eq("id", accountId) : query.ilike("email", emailInput!);
    const { data: account, error: accErr } = await query.maybeSingle();

    if (accErr) return json({ error: accErr.message }, 500);
    if (!account) return json({ error: "Account not found" }, 404);
    if (account.status !== "approved") return json({ error: "Account is not approved" }, 400);
    if (!BREVO_API_KEY) return json({ error: "Email service not configured" }, 500);

    const nameRaw =
      account.contact_name ||
      account.company_name ||
      String(account.email).split("@")[0];
    const name = escapeHtml(String(nameRaw));

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #222;">
      <h2 style="color:#ff9004; margin-bottom: 4px;">Your price portal access is approved</h2>
      <p>Dear ${name},</p>
      <p>Your account for the Noga MT customer price portal has been approved and is ready to use.</p>
      <p>Sign in with the email address you registered with: <b>${escapeHtml(String(account.email))}</b></p>
      ${account.is_account_admin
        ? `<p>As the account administrator, you can also invite and manage colleagues from your company inside the portal.</p>`
        : ""}
      <p style="margin-top:20px;">
        <a href="${PORTAL_PRICES_URL}" style="background:#ff9004; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Open your price portal</a>
      </p>
      <p style="color:#666; font-size:13px; margin-top:24px;">
        If you have any questions, simply reply to this email.<br/>
        <b style="color:#ff9004;">Noga Engineering &amp; Technology</b>
      </p>
    </div>`;

    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: "Noga Quote Portal", email: "quotes@noga-mt.com" },
        to: [{ email: account.email }],
        bcc: [{ email: BCC_EMAIL }],
        subject: "Your Noga MT price portal access is approved",
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("Brevo send failed", res.status, details);
      return json({ error: "Email send failed", status: res.status, details }, 502);
    }

    return json({ ok: true, sentTo: account.email });
  } catch (err) {
    console.error("notify-portal-approval error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
