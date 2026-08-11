import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const PERMISSIONS = [
  { key: 'price_portal', label: 'Price Portal' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

/** Permissions of the currently signed-in user (admins implicitly have all). */
export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('user_permissions').select('permission').eq('user_id', user.id),
    ]);
    const admin = (roles || []).some((r: { role: string }) => r.role === 'admin');
    setIsAdmin(admin);
    setPermissions((perms || []).map((p: { permission: string }) => p.permission));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission: PermissionKey) => isAdmin || permissions.includes(permission),
    [isAdmin, permissions]
  );

  return { permissions, isAdmin, loading, can, refresh: load };
};

/** Admin helper: read/grant/revoke permissions for any user. */
export const fetchAllPermissions = async () => {
  const { data } = await supabase.from('user_permissions').select('user_id, permission');
  const map: Record<string, string[]> = {};
  (data || []).forEach((row: { user_id: string; permission: string }) => {
    map[row.user_id] = [...(map[row.user_id] || []), row.permission];
  });
  return map;
};

export const setPermission = async (userId: string, permission: string, enabled: boolean) => {
  if (enabled) {
    const { error } = await supabase
      .from('user_permissions')
      .upsert({ user_id: userId, permission }, { onConflict: 'user_id,permission', ignoreDuplicates: true });
    return error;
  }
  const { error } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('permission', permission);
  return error;
};
