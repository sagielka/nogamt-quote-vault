import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PriceList } from '@/data/product-catalog';

export interface CustomerAccount {
  id: string;
  user_id: string;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  price_list: PriceList | null;
  notes: string | null;
  approved_at: string | null;
  created_at: string;
}

export const useCustomerAccount = () => {
  const { user, loading: authLoading } = useAuth();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase
      .from('customer_accounts' as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle() as any);
    setAccount((data as CustomerAccount) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const createAccount = useCallback(
    async (companyName: string, contactName: string) => {
      if (!user) return { error: new Error('Not signed in') };
      const { error } = await (supabase.from('customer_accounts' as any).insert({
        user_id: user.id,
        email: user.email,
        company_name: companyName || null,
        contact_name: contactName || null,
        status: 'pending',
      } as any) as any);
      if (!error) {
        // De-duplicate, auto-assign to the matching company and notify the admin
        try {
          await supabase.functions.invoke('notify-portal-signup');
        } catch (e) {
          console.error('Portal signup notification failed', e);
        }
        await refresh();
      }
      return { error };
    },
    [user, refresh]
  );


  return { account, loading: loading || authLoading, refresh, createAccount };
};
