import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST USERS
    if (req.method === "GET" && action === "list") {
      const {
        data: { users },
        error,
      } = await adminClient.auth.admin.listUsers({ perPage: 100 });

      if (error) throw error;

      // Get roles
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      // Get profiles (last_seen)
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, display_name, is_active, last_seen_at");

      // Get quotation counts
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

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLE
    if (req.method === "POST" && action === "update-role") {
      const { userId, role } = await req.json();

      if (!userId || !role) {
        return new Response(JSON.stringify({ error: "userId and role required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent admin from changing own role
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot change your own role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert role
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

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BAN / UNBAN USER
    if (req.method === "POST" && action === "toggle-ban") {
      const { userId, ban } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot ban yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ban) {
        // Ban for 100 years
        const banUntil = new Date();
        banUntil.setFullYear(banUntil.getFullYear() + 100);
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876000h", // ~100 years
        });
      } else {
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
