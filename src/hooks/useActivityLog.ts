import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export const useActivityLog = () => {
  const { user } = useAuth();

  const logActivity = useCallback(async (
    action: string,
    entityType: string,
    entityId?: string,
    entityLabel?: string,
    details?: Record<string, any>
  ) => {
    if (!user) return;
    try {
      await supabase.from('activity_log' as any).insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_label: entityLabel || null,
        details: details || null,
      } as any);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }, [user]);

  const getActivities = useCallback(async (
    entityType?: string,
    entityId?: string,
    limit = 50
  ): Promise<ActivityLogEntry[]> => {
    let query = (supabase.from('activity_log' as any).select('*') as any)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch activities:', error);
      return [];
    }
    return (data || []) as ActivityLogEntry[];
  }, []);

  const getRecentActivities = useCallback(async (limit = 20): Promise<ActivityLogEntry[]> => {
    return getActivities(undefined, undefined, limit);
  }, [getActivities]);

  return { logActivity, getActivities, getRecentActivities };
};
