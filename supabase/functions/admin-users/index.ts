import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await anonClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
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

      const quotationCounts: Record<string, number> = {};
      quotations?.forEach((q: { user_id: string }) => {
        quotationCounts[q.user_id] = (quotationCounts[q.user_id] || 0) + 1;
      });

      const rolesMap: Record<string, string> = {};
      roles?.forEach((r: { user_id: string; role: string }) => {
        rolesMap[r.user_id] = r.role;
      });

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
        display_name: profilesMap[u.id]?.display_name || null,
        is_active: profilesMap[u.id]?.is_active ?? true,
        last_seen_at: profilesMap[u.id]?.last_seen_at || null,
        banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
        quotation_count: quotationCounts[u.id] || 0,
      }));

      return jsonResponse({ users: enrichedUsers });
    }

    // ─── INVITE USER (create + send invite email) ───
    if (req.method === "POST" && action === "invite") {
      const { email, role } = await req.json();

      if (!email) {
        return jsonResponse({ error: "Email is required" }, 400);
      }

      // Create user with invite (sends magic link email automatically)
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { invited_by: user.email },
        });

      if (createError) {
        // Check for duplicate
        if (createError.message?.includes("already been registered")) {
          return jsonResponse({ error: "A user with this email already exists" }, 409);
        }
        throw createError;
      }

      // Assign role if specified
      if (role && role !== "user" && newUser?.user) {
        await adminClient
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });
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
      await adminClient.from("profiles").delete().eq("user_id", userId);

      return jsonResponse({ success: true });
    }

    // ─── RESET PASSWORD (send reset email) ───
    if (req.method === "POST" && action === "reset-password") {
      const { email } = await req.json();

      if (!email) {
        return jsonResponse({ error: "Email required" }, 400);
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

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
