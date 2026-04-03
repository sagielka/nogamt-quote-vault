import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PortalToken {
  id: string;
  quotation_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  client_response: string | null;
  client_response_at: string | null;
  client_comment: string | null;
  is_active: boolean;
  created_at: string;
}

export const useCustomerPortal = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const generatePortalLink = useCallback(async (
    quotationId: string,
    expiresInDays = 30
  ): Promise<PortalToken | null> => {
    if (!user) return null;
    setLoading(true);
    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await (supabase
        .from('customer_portal_tokens' as any)
        .insert({
          quotation_id: quotationId,
          created_by: user.id,
          expires_at: expiresAt,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return data as PortalToken;
    } catch (err) {
      console.error('Failed to generate portal link:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getPortalTokens = useCallback(async (quotationId: string): Promise<PortalToken[]> => {
    const { data, error } = await (supabase
      .from('customer_portal_tokens' as any)
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: false }) as any);

    if (error) return [];
    return (data || []) as PortalToken[];
  }, []);

  const deactivateToken = useCallback(async (tokenId: string) => {
    await (supabase
      .from('customer_portal_tokens' as any)
      .update({ is_active: false } as any)
      .eq('id', tokenId) as any);
  }, []);

  return { loading, generatePortalLink, getPortalTokens, deactivateToken };
};
