import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_RE = /^[^\s@]+@[^\s@,;]+\.[A-Za-z]{2,}$/;
const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    let user: { id: string; email: string };
    try {
      const payload = JSON.parse(
        atob(authHeader.replace("Bearer ", "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (!payload.sub) throw new Error("no sub");
      user = { id: payload.sub, email: payload.email || "" };
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Caller must own an approved portal account
    const { data: account } = await admin
      .from("customer_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account || account.status !== "approved") {
      return json({ error: "Your portal account is not approved yet." }, 403);
    }

    // The "owner" account of the team is the root of the parent chain
    const rootId: string = account.parent_account_id || account.id;
    const { data: rootAccount } = await admin
      .from("customer_accounts")
      .select("*")
      .eq("id", rootId)
      .maybeSingle();
    if (!rootAccount) return json({ error: "Account not found" }, 404);

    const listTeam = async () => {
      const { data } = await admin
        .from("customer_accounts")
        .select("id, email, contact_name, company_name, status, created_at, parent_account_id")
        .or(`id.eq.${rootId},parent_account_id.eq.${rootId}`)
        .order("created_at", { ascending: true });
      return (data || []).map((m: any) => ({ ...m, is_owner: m.id === rootId }));
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    if (req.method === "GET" || action === "list") {
      return json({ team: await listTeam(), owner_id: rootId, is_owner: account.id === rootId });
    }

    if (req.method === "POST" && action === "add") {
      if (account.id !== rootId) {
        return json({ error: "Only the main account holder can add users." }, 403);
      }

      const body = await req.json();
      const email = cleanEmail(body.email);
      const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";

      if (!EMAIL_RE.test(email)) return json({ error: `"${email}" is not a valid email address` }, 400);

      const { data: existingAccount } = await admin
        .from("customer_accounts")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (existingAccount) return json({ error: "This email already has a portal account." }, 409);

      let targetUserId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { invited_by: user.email, account_type: "customer" },
      });

      if (createErr) {
        if (!createErr.message?.toLowerCase().includes("already")) throw createErr;
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: "User exists but could not be located" }, 409);
        targetUserId = existing.id;
      } else {
        targetUserId = created.user!.id;
      }

      // A portal teammate must never hold app-user roles
      await admin.from("user_roles").delete().eq("user_id", targetUserId);

      const { error: insErr } = await admin.from("customer_accounts").insert({
        user_id: targetUserId,
        email,
        company_name: rootAccount.company_name,
        contact_name: contactName || null,
        price_list: rootAccount.price_list,
        status: "approved",
        approved_by: rootAccount.approved_by,
        approved_at: new Date().toISOString(),
        parent_account_id: rootId,
      });
      if (insErr) throw insErr;

      return json({ success: true, message: `Invite sent to ${email}.`, team: await listTeam() });
    }

    if (req.method === "POST" && action === "remove") {
      if (account.id !== rootId) {
        return json({ error: "Only the main account holder can remove users." }, 403);
      }
      const { memberId } = await req.json();
      if (!memberId || memberId === rootId) return json({ error: "Invalid member" }, 400);

      const { error: delErr } = await admin
        .from("customer_accounts")
        .update({ status: "rejected" })
        .eq("id", memberId)
        .eq("parent_account_id", rootId);
      if (delErr) throw delErr;

      return json({ success: true, team: await listTeam() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("portal-team error:", e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});
