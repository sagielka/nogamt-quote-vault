import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_RE = /^[^\s@]+@[^\s@,;]+\.[A-Za-z]{2,}$/;
const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

const jsonResponse = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Decode JWT payload to get user info (no session check needed)
    const token = authHeader.replace("Bearer ", "");
    let user: { id: string; email: string };
    try {
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
      if (!payload.sub) throw new Error("No sub in token");
      user = { id: payload.sub, email: payload.email || "" };
    } catch (e) {
      console.error("JWT decode failed:", e.message);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    const portalAction =
      new URL(req.url).searchParams.get("action") === "create-portal-user";
    let allowed = !!isAdmin;
    if (!allowed && portalAction) {
      const { data: canPortal } = await anonClient.rpc("has_permission", {
        _user_id: user.id,
        _permission: "price_portal",
      });
      allowed = !!canPortal;
    }

    if (!allowed) {
      return jsonResponse({ error: "Admin access required" }, 403);
    }


    // adminClient already created above
    const url = new URL(req.url);
    const action = url.searchParams.get("action");


    // ─── LIST USERS ───
    if (req.method === "GET" && action === "list") {
      const {
        data: { users },
        error,
      } = await adminClient.auth.admin.listUsers({ perPage: 100 });

      if (error) throw error;

      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, display_name, is_active, last_seen_at");

      const { data: quotations } = await adminClient
        .from("quotations")
        .select("user_id");

      const { data: customerAccounts } = await adminClient
        .from("customer_accounts")
        .select("user_id, company_name, status, price_list");

      const quotationCounts: Record<string, number> = {};
      quotations?.forEach((q: { user_id: string }) => {
        quotationCounts[q.user_id] = (quotationCounts[q.user_id] || 0) + 1;
      });

      const rolesMap: Record<string, string> = {};
      roles?.forEach((r: { user_id: string; role: string }) => {
        rolesMap[r.user_id] = r.role;
      });

      const customerMap: Record<
        string,
        { company_name: string | null; status: string; price_list: string | null }
      > = {};
      customerAccounts?.forEach(
        (c: {
          user_id: string;
          company_name: string | null;
          status: string;
          price_list: string | null;
        }) => {
          customerMap[c.user_id] = {
            company_name: c.company_name,
            status: c.status,
            price_list: c.price_list,
          };
        },
      );

      const profilesMap: Record<string, { display_name: string | null; is_active: boolean; last_seen_at: string | null }> = {};
      profiles?.forEach((p: { user_id: string; display_name: string | null; is_active: boolean; last_seen_at: string | null }) => {
        profilesMap[p.user_id] = p;
      });

      const enrichedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: rolesMap[u.id] || "user",
        has_staff_role: !!rolesMap[u.id],
        is_customer: !!customerMap[u.id],
        customer_company: customerMap[u.id]?.company_name ?? null,
        customer_status: customerMap[u.id]?.status ?? null,
        customer_price_list: customerMap[u.id]?.price_list ?? null,
        display_name: profilesMap[u.id]?.display_name || null,
        is_active: profilesMap[u.id]?.is_active ?? true,
        last_seen_at: profilesMap[u.id]?.last_seen_at || null,
        banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
        quotation_count: quotationCounts[u.id] || 0,
      }));


      return jsonResponse({ users: enrichedUsers });
    }

    // ─── INVITE USER (app user) or INVITE CUSTOMER (portal only) ───
    if (req.method === "POST" && action === "invite") {
      const { email: rawEmail, role, kind, priceList, companyName, contactName } = await req.json();
      const email = cleanEmail(rawEmail);
      const inviteKind = kind === "customer" ? "customer" : "staff";

      if (!email) {
        return jsonResponse({ error: "Email is required" }, 400);
      }
      if (!EMAIL_RE.test(email)) {
        return jsonResponse({ error: `"${email}" is not a valid email address` }, 400);
      }
      if (inviteKind === "customer" && !priceList) {
        return jsonResponse({ error: "A price list is required for customer invites" }, 400);
      }

      // Cross-contamination guards: a customer must never get app privileges
      const { data: existingCustomer } = await adminClient
        .from("customer_accounts")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (inviteKind === "staff" && existingCustomer) {
        return jsonResponse(
          { error: `${email} is already a portal customer. Customers cannot be invited as app users.` },
          409,
        );
      }

      // Create user with invite (sends magic link email automatically)
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { invited_by: user.email, account_type: inviteKind },
        });

      if (createError) {
        // Check for duplicate
        if (createError.message?.includes("already been registered")) {
          return jsonResponse({ error: "A user with this email already exists" }, 409);
        }
        throw createError;
      }

      const newUserId = newUser?.user?.id;

      if (inviteKind === "customer") {
        if (newUserId) {
          // Never grant staff roles to a customer
          await adminClient.from("user_roles").delete().eq("user_id", newUserId);
          const { error: insErr } = await adminClient.from("customer_accounts").insert({
            user_id: newUserId,
            email,
            company_name: companyName || null,
            contact_name: contactName || null,
            price_list: priceList,
            status: "approved",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          });
          if (insErr) throw insErr;
        }
        return jsonResponse({
          success: true,
          message: `Customer invite sent to ${email}. They can set a password and view the ${priceList} price list.`,
        });
      }

      // Assign role if specified
      if (role && role !== "user" && newUserId) {
        await adminClient
          .from("user_roles")
          .insert({ user_id: newUserId, role });
      }

      return jsonResponse({
        success: true,
        message: `Invite sent to ${email}. They will receive an email to set up their password.`,
      });
    }

    // ─── DELETE USER ───
    if (req.method === "POST" && action === "delete-user") {
      const { userId } = await req.json();

      if (!userId) {
        return jsonResponse({ error: "userId required" }, 400);
      }

      if (userId === user.id) {
        return jsonResponse({ error: "Cannot delete yourself" }, 400);
      }

      // Delete from auth (cascades to user_roles via FK if set, or clean up manually)
      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      // Clean up related data
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("user_permissions").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);

      // Portal account cleanup: detach any linked members, then remove the account row
      const { data: accts } = await adminClient
        .from("customer_accounts")
        .select("id")
        .eq("user_id", userId);
      for (const a of accts ?? []) {
        await adminClient
          .from("customer_accounts")
          .update({ parent_account_id: null })
          .eq("parent_account_id", a.id);
      }
      await adminClient.from("customer_accounts").delete().eq("user_id", userId);

      return jsonResponse({ success: true });
    }

    // ─── RESET PASSWORD (send reset email) ───
    if (req.method === "POST" && action === "reset-password") {
      const { email: rawEmail } = await req.json();
      const email = cleanEmail(rawEmail);

      if (!email) {
        return jsonResponse({ error: "Email required" }, 400);
      }
      if (!EMAIL_RE.test(email)) {
        return jsonResponse({ error: `"${email}" is not a valid email address` }, 400);
      }

      // Generate a password reset link and the API sends the email
      const { error: resetError } =
        await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
        });

      if (resetError) throw resetError;

      return jsonResponse({
        success: true,
        message: `Password reset email sent to ${email}.`,
      });
    }

    // ─── UPDATE ROLE ───
    if (req.method === "POST" && action === "update-role") {
      const { userId, role } = await req.json();

      if (!userId || !role) {
        return jsonResponse({ error: "userId and role required" }, 400);
      }

      if (userId === user.id) {
        return jsonResponse({ error: "Cannot change your own role" }, 400);
      }

      // A portal customer must never receive app-user privileges
      const { data: custAcct } = await adminClient
        .from("customer_accounts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (custAcct) {
        return jsonResponse(
          { error: "This account is a portal customer and cannot be given app-user roles." },
          409,
        );
      }



      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existing) {
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
      } else {
        await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role });
      }

      return jsonResponse({ success: true });
    }

    // ─── BAN / UNBAN USER ───
    if (req.method === "POST" && action === "toggle-ban") {
      const { userId, ban } = await req.json();

      if (!userId) {
        return jsonResponse({ error: "userId required" }, 400);
      }

      if (userId === user.id) {
        return jsonResponse({ error: "Cannot ban yourself" }, 400);
      }

      if (ban) {
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });
      } else {
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
      }

      return jsonResponse({ success: true });
    }

    // ─── SET PASSWORD ───
    if (req.method === "POST" && action === "set-password") {
      const { userId, password } = await req.json();

      if (!userId || !password) {
        return jsonResponse({ error: "userId and password required" }, 400);
      }

      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
      }

      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true });

      if (updateError) throw updateError;

      return jsonResponse({
        success: true,
        message: "Password has been set successfully.",
      });
    }

    // ─── CREATE PORTAL (CUSTOMER) USER ───
    if (req.method === "POST" && action === "create-portal-user") {
      const { email, password, companyName, contactName, priceList, notes, parentAccountId } =
        await req.json();

      // When linking to an existing portal account, details are inherited from it
      let parentAccount: any = null;
      if (parentAccountId) {
        const { data: parent } = await adminClient
          .from("customer_accounts")
          .select("*")
          .eq("id", parentAccountId)
          .maybeSingle();
        if (!parent) return jsonResponse({ error: "Parent portal account not found" }, 404);
        // Always link to the root of the chain
        if (parent.parent_account_id) {
          const { data: root } = await adminClient
            .from("customer_accounts")
            .select("*")
            .eq("id", parent.parent_account_id)
            .maybeSingle();
          parentAccount = root || parent;
        } else {
          parentAccount = parent;
        }
      }

      const effectivePriceList = priceList || parentAccount?.price_list || null;

      if (!email || !effectivePriceList) {
        return jsonResponse({ error: "email and priceList are required" }, 400);
      }
      if (password && password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
      }

      const normalizedEmail = cleanEmail(email);
      if (!EMAIL_RE.test(normalizedEmail)) {
        return jsonResponse({ error: `"${normalizedEmail}" is not a valid email address` }, 400);
      }
      let targetUserId: string | null = null;

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: password || undefined,
        email_confirm: true,
      });

      if (createError) {
        if (!createError.message?.toLowerCase().includes("already")) throw createError;
        // Find existing user by email
        const { data: list } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (!existing) return jsonResponse({ error: "User exists but could not be located" }, 409);
        targetUserId = existing.id;
        if (password) {
          await adminClient.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        }
      } else {
        targetUserId = created.user!.id;
      }

      const { data: existingAccount } = await adminClient
        .from("customer_accounts")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      // A portal user must never hold app-user roles
      await adminClient.from("user_roles").delete().eq("user_id", targetUserId);

      const payload: Record<string, unknown> = {
        user_id: targetUserId,
        email: normalizedEmail,
        company_name: companyName || parentAccount?.company_name || null,
        contact_name: contactName || null,
        notes: notes || null,
        price_list: effectivePriceList,
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        parent_account_id: parentAccount?.id || null,
      };

      if (existingAccount) {
        const { error: upErr } = await adminClient
          .from("customer_accounts")
          .update(payload)
          .eq("id", existingAccount.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await adminClient.from("customer_accounts").insert(payload);
        if (insErr) throw insErr;
      }

      return jsonResponse({ success: true, userId: targetUserId });
    }

    return jsonResponse({ error: "Unknown action" }, 400);

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
