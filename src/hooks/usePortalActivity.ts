import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortalActivityEntry {
  id: string;
  user_id: string;
  email: string | null;
  event: string;
  details: Record<string, any> | null;
  path: string | null;
  user_agent: string | null;
  created_at: string;
}

export const PORTAL_EVENT_LABELS: Record<string, string> = {
  portal_visit: 'Opened the portal',
  price_list_viewed: 'Viewed prices',
  price_list_download: 'Downloaded price list (Excel)',
  quote_pdf_download: 'Downloaded a quotation PDF',
  quote_request: 'Requested a quote',
  search: 'Searched the catalog',
};

/** Fire-and-forget logging of customer portal usage. */
export const logPortalEvent = async (
  event: string,
  details?: Record<string, any>
) => {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    await (supabase.from('portal_activity' as any).insert({
      user_id: user.id,
      email: user.email || null,
      event,
      details: details || null,
      path: typeof window !== 'undefined' ? window.location.hash || window.location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    } as any) as any);
  } catch (err) {
    console.error('Failed to log portal activity:', err);
  }
};

export const usePortalActivity = () => {
  const getActivity = useCallback(
    async (userIds: string[], limit = 200): Promise<PortalActivityEntry[]> => {
      if (userIds.length === 0) return [];
      const { data, error } = await (supabase
        .from('portal_activity' as any)
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(limit) as any);
      if (error) {
        console.error('Failed to load portal activity:', error);
        return [];
      }
      return (data || []) as PortalActivityEntry[];
    },
    []
  );

  return { getActivity, logPortalEvent };
};
