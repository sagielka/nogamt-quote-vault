import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Quotation, QuotationFormData } from '@/types/quotation';

export interface QuotationVersion {
  id: string;
  quotation_id: string;
  version_number: number;
  changed_by: string;
  change_summary: string | null;
  items: any[];
  notes: string | null;
  tax_rate: number;
  discount_type: string | null;
  discount_value: number;
  currency: string;
  client_name: string;
  client_email: string;
  client_address: string | null;
  valid_until: string;
  attachments: any[] | null;
  created_at: string;
}

export const useQuotationVersions = () => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const saveVersion = useCallback(async (
    quotation: Quotation,
    changeSummary?: string
  ) => {
    if (!user) return;

    try {
      // Get current max version number
      const { data: existing } = await (supabase
        .from('quotation_versions' as any)
        .select('version_number')
        .eq('quotation_id', quotation.id)
        .order('version_number', { ascending: false })
        .limit(1) as any);

      const nextVersion = existing && existing.length > 0
        ? (existing[0] as any).version_number + 1
        : 1;

      await (supabase.from('quotation_versions' as any).insert({
        quotation_id: quotation.id,
        version_number: nextVersion,
        changed_by: user.id,
        change_summary: changeSummary || null,
        items: quotation.items,
        notes: quotation.notes || null,
        tax_rate: quotation.taxRate,
        discount_type: quotation.discountType || null,
        discount_value: quotation.discountValue || 0,
        currency: quotation.currency,
        client_name: quotation.clientName,
        client_email: quotation.clientEmail,
        client_address: quotation.clientAddress || null,
        valid_until: quotation.validUntil.toISOString(),
        attachments: quotation.attachments || null,
      } as any) as any);
    } catch (err) {
      console.error('Failed to save version:', err);
    }
  }, [user]);

  const fetchVersions = useCallback(async (quotationId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('quotation_versions' as any)
        .select('*')
        .eq('quotation_id', quotationId)
        .order('version_number', { ascending: false }) as any);

      if (!error && data) {
        setVersions(data as QuotationVersion[]);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { versions, loading, saveVersion, fetchVersions };
};
