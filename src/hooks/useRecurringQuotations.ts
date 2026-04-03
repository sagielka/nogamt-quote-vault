import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineItem, Currency } from '@/types/quotation';

export interface RecurringQuotation {
  id: string;
  user_id: string;
  customer_id: string | null;
  client_name: string;
  client_email: string;
  client_address: string | null;
  template_items: LineItem[];
  currency: Currency;
  tax_rate: number;
  discount_type: string | null;
  discount_value: number;
  notes: string | null;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useRecurringQuotations = () => {
  const { user } = useAuth();
  const [recurring, setRecurring] = useState<RecurringQuotation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurring = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase
        .from('recurring_quotations' as any)
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (!error && data) {
        setRecurring(data as RecurringQuotation[]);
      }
    } catch (err) {
      console.error('Failed to fetch recurring quotations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const createRecurring = useCallback(async (data: {
    clientName: string;
    clientEmail: string;
    clientAddress?: string;
    templateItems: LineItem[];
    currency: Currency;
    taxRate: number;
    discountType?: string;
    discountValue?: number;
    notes?: string;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    nextRunAt: Date;
    customerId?: string;
  }): Promise<RecurringQuotation | null> => {
    if (!user) return null;
    try {
      const { data: newRow, error } = await (supabase
        .from('recurring_quotations' as any)
        .insert({
          user_id: user.id,
          customer_id: data.customerId || null,
          client_name: data.clientName,
          client_email: data.clientEmail,
          client_address: data.clientAddress || null,
          template_items: data.templateItems,
          currency: data.currency,
          tax_rate: data.taxRate,
          discount_type: data.discountType || null,
          discount_value: data.discountValue || 0,
          notes: data.notes || null,
          frequency: data.frequency,
          next_run_at: data.nextRunAt.toISOString(),
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      const created = newRow as RecurringQuotation;
      setRecurring(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create recurring quotation:', err);
      return null;
    }
  }, [user]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    await (supabase
      .from('recurring_quotations' as any)
      .update({ is_active: isActive } as any)
      .eq('id', id) as any);
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, is_active: isActive } : r));
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    await (supabase.from('recurring_quotations' as any).delete().eq('id', id) as any);
    setRecurring(prev => prev.filter(r => r.id !== id));
  }, []);

  return { recurring, loading, createRecurring, toggleActive, deleteRecurring, refreshRecurring: fetchRecurring };
};
