import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const ADMIN_EMAIL = "sagi@noga.com";
const PORTAL_ADMIN_URL = "https://quote.noga-mt.com/#/price-list";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();
const domainOf = (email: string) => norm(email).split("@")[1] || "";
const GENERIC_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
  "live.com", "msn.com", "aol.com", "proton.me", "protonmail.com",
]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anon.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: me } = await admin
      .from("customer_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me) return json({ error: "No portal account found" }, 404);

    const { data: allAccounts } = await admin
      .from("customer_accounts")
      .select("id, email, company_name, price_list, status, parent_account_id, created_at")
      .order("created_at", { ascending: true });

    const others = (allAccounts || []).filter((a: any) => a.id !== me.id);
    const myEmail = norm(me.email);
    const myDomain = domainOf(me.email);
    const myCompany = norm(me.company_name);

    // ---- Duplicate detection -------------------------------------------------
    const duplicateEmail = others.find((a: any) => norm(a.email) === myEmail) || null;
    const sameCompany = others.find(
      (a: any) => myCompany && norm(a.company_name) === myCompany
    ) || null;
    const sameDomain =
      myDomain && !GENERIC_DOMAINS.has(myDomain)
        ? others.find((a: any) => domainOf(a.email) === myDomain) || null
        : null;

    // ---- Auto-assign to the company ----------------------------------------
    const rootOf = (a: any) =>
      a?.parent_account_id
        ? others.find((o: any) => o.id === a.parent_account_id) || a
        : a;

    const match = duplicateEmail || sameCompany || sameDomain;
    const parent = match ? rootOf(match) : null;

    const updates: Record<string, unknown> = {};
    let assignedTo: string | null = null;

    if (parent && parent.id !== me.id && !me.parent_account_id) {
      updates.parent_account_id = parent.id;
      assignedTo = parent.company_name || parent.email;
      if (!me.company_name && parent.company_name) updates.company_name = parent.company_name;
      if (!me.price_list && parent.price_list) updates.price_list = parent.price_list;
      // Inherit approval from an already-approved company account
      if (parent.status === "approved" && me.status === "pending") {
        updates.status = "approved";
        updates.approved_at = new Date().toISOString();
      }
    }

    // Fall back to matching an existing customer record for the price list
    if (!updates.price_list && !me.price_list) {
      const { data: customers } = await admin
        .from("customers")
        .select("name, email, price_list");
      const custMatch = (customers || []).find((c: any) => {
        const emails = String(c.email || "").split(",").map((e: string) => norm(e));
        return (
          emails.includes(myEmail) ||
          (myCompany && norm(c.name) === myCompany) ||
          (myDomain && !GENERIC_DOMAINS.has(myDomain) && emails.some((e) => e.endsWith("@" + myDomain)))
        );
      });
      if (custMatch) {
        if (custMatch.price_list) updates.price_list = custMatch.price_list;
        if (!me.company_name && custMatch.name) updates.company_name = custMatch.name;
        assignedTo = assignedTo || custMatch.name;
      }
    }

    if (Object.keys(updates).length > 0) {
      await admin.from("customer_accounts").update(updates).eq("id", me.id);
    }

    const finalStatus = (updates.status as string) || me.status;

    // ---- Notify admin --------------------------------------------------------
    if (BREVO_API_KEY) {
      const rows: [string, string][] = [
        ["Email", me.email],
        ["Company", String(updates.company_name || me.company_name || "—")],
        ["Contact", me.contact_name || "—"],
        ["Status", finalStatus],
        ["Auto-assigned to", assignedTo || "— (no match found)"],
        ["Price list", String(updates.price_list || me.price_list || "— (not assigned)")],
        [
          "Duplicate check",
          duplicateEmail
            ? `Existing account with the same email (${duplicateEmail.email})`
            : sameCompany
            ? `Existing account for the same company (${sameCompany.company_name})`
            : sameDomain
            ? `Existing account on the same domain (${sameDomain.email})`
            : "No duplicates found",
        ],
      ];

      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #222;">
        <h2 style="color:#ff9004; margin-bottom: 4px;">New customer portal request</h2>
        <p style="color:#666; margin-top:0;">A new customer signed up for the price portal${
          finalStatus === "pending" ? " and is waiting for your approval" : ""
        }.</p>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 10px; border:1px solid #eee; background:#fafafa; width:180px;"><b>${k}</b></td><td style="padding:6px 10px; border:1px solid #eee;">${v}</td></tr>`
            )
            .join("")}
        </table>
        <p style="margin-top:20px;">
          <a href="${PORTAL_ADMIN_URL}" style="background:#ff9004; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Review in Price Portal</a>
        </p>
      </div>`;

      try {
        await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: "Noga Quote Portal", email: "quotes@noga-mt.com" },
            to: [{ email: ADMIN_EMAIL }],
            subject: `New portal request: ${updates.company_name || me.company_name || me.email}`,
            htmlContent: html,
          }),
        });
      } catch (e) {
        console.error("Brevo notify failed", e);
      }
    }

    return json({
      ok: true,
      status: finalStatus,
      assignedTo,
      duplicate: Boolean(duplicateEmail || sameCompany || sameDomain),
    });
  } catch (err) {
    console.error("notify-portal-signup error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
