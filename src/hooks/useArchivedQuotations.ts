import { useState, useCallback, useEffect } from 'react';
import { Quotation } from '@/types/quotation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ArchivedQuotation extends Quotation {
  originalId: string;
  archivedAt: Date;
  archivedBy: string;
}

// Helper to convert database row to ArchivedQuotation type
const dbRowToArchivedQuotation = (row: any): ArchivedQuotation => ({
  id: row.id,
  originalId: row.original_id,
  quoteNumber: row.quote_number,
  clientName: row.client_name,
  clientEmail: row.client_email,
  clientAddress: row.client_address || '',
  items: row.items || [],
  taxRate: parseFloat(row.tax_rate) || 0,
  discountType: row.discount_type || 'percentage',
  discountValue: parseFloat(row.discount_value) || 0,
  notes: row.notes || '',
  currency: row.currency || 'USD',
  status: row.status || 'draft',
  attachments: row.attachments || [],
  createdAt: new Date(row.created_at),
  validUntil: new Date(row.valid_until),
  archivedAt: new Date(row.archived_at),
  archivedBy: row.archived_by,
});

export const useArchivedQuotations = () => {
  const [archivedQuotations, setArchivedQuotations] = useState<ArchivedQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  // Check if current user is admin
  const checkAdminRole = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
      setIsAdmin(false);
    }
  }, [user]);

  // Fetch archived quotations from database
  const fetchArchivedQuotations = useCallback(async () => {
    if (!user) {
      setArchivedQuotations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('archived_quotations')
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) {
        console.error('Error fetching archived quotations:', error);
        setArchivedQuotations([]);
      } else if (data) {
        setArchivedQuotations(data.map(dbRowToArchivedQuotation));
      }
    } catch (err) {
      console.error('Error fetching archived quotations:', err);
      setArchivedQuotations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load archived quotations when user changes
  useEffect(() => {
    if (user) {
      checkAdminRole();
      fetchArchivedQuotations();
    } else {
      setArchivedQuotations([]);
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user, checkAdminRole, fetchArchivedQuotations]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('archived-quotations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'archived_quotations',
        },
        (payload) => {
          console.log('Archived quotations realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            const newArchived = dbRowToArchivedQuotation(payload.new);
            setArchivedQuotations((prev) => {
              // Avoid duplicates
              if (prev.some((q) => q.id === newArchived.id)) return prev;
              return [newArchived, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedArchived = dbRowToArchivedQuotation(payload.new);
            setArchivedQuotations((prev) =>
              prev.map((q) => (q.id === updatedArchived.id ? updatedArchived : q))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setArchivedQuotations((prev) => prev.filter((q) => q.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Archive a quotation (move from quotations to archived_quotations)
  const archiveQuotation = useCallback(async (quotation: Quotation): Promise<boolean> => {
    if (!user) return false;

    try {
      // Insert into archived_quotations
      const { error: insertError } = await supabase
        .from('archived_quotations')
        .insert({
          original_id: quotation.id,
          user_id: user.id,
          quote_number: quotation.quoteNumber,
          client_name: quotation.clientName,
          client_email: quotation.clientEmail,
          client_address: quotation.clientAddress || null,
          items: quotation.items,
          tax_rate: quotation.taxRate,
          discount_type: quotation.discountType,
          discount_value: quotation.discountValue,
          notes: quotation.notes || null,
          currency: quotation.currency,
          status: quotation.status,
          attachments: quotation.attachments || [],
          valid_until: quotation.validUntil.toISOString(),
          created_at: quotation.createdAt.toISOString(),
          archived_by: user.id,
        } as any);

      if (insertError) {
        console.error('Error archiving quotation:', insertError);
        return false;
      }

      // Delete from quotations
      const { error: deleteError } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotation.id);

      if (deleteError) {
        console.error('Error deleting original quotation:', deleteError);
        return false;
      }

      // Refresh archived quotations
      await fetchArchivedQuotations();
      return true;
    } catch (err) {
      console.error('Error archiving quotation:', err);
      return false;
    }
  }, [user, fetchArchivedQuotations]);

  // Permanently delete from archive (admin only)
  const permanentlyDeleteQuotation = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !isAdmin) {
      console.error('Permission denied: only admins can permanently delete');
      return false;
    }

    try {
      const { error } = await supabase
        .from('archived_quotations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error permanently deleting quotation:', error);
        return false;
      }

      setArchivedQuotations((prev) => prev.filter((q) => q.id !== id));
      return true;
    } catch (err) {
      console.error('Error permanently deleting quotation:', err);
      return false;
    }
  }, [user, isAdmin]);

  // Restore quotation from archive back to active quotations
  const restoreQuotation = useCallback(async (archivedQuotation: ArchivedQuotation): Promise<boolean> => {
    if (!user) return false;

    try {
      // Insert back into quotations
      const { error: insertError } = await supabase
        .from('quotations')
        .insert({
          user_id: user.id,
          quote_number: archivedQuotation.quoteNumber,
          client_name: archivedQuotation.clientName,
          client_email: archivedQuotation.clientEmail,
          client_address: archivedQuotation.clientAddress || null,
          items: archivedQuotation.items,
          tax_rate: archivedQuotation.taxRate,
          discount_type: archivedQuotation.discountType,
          discount_value: archivedQuotation.discountValue,
          notes: archivedQuotation.notes || null,
          currency: archivedQuotation.currency,
          status: archivedQuotation.status,
          attachments: archivedQuotation.attachments || [],
          valid_until: archivedQuotation.validUntil.toISOString(),
        } as any);

      if (insertError) {
        console.error('Error restoring quotation:', insertError);
        return false;
      }

      // Delete from archived_quotations
      const { error: deleteError } = await supabase
        .from('archived_quotations')
        .delete()
        .eq('id', archivedQuotation.id);

      if (deleteError) {
        console.error('Error removing from archive:', deleteError);
        return false;
      }

      setArchivedQuotations((prev) => prev.filter((q) => q.id !== archivedQuotation.id));
      return true;
    } catch (err) {
      console.error('Error restoring quotation:', err);
      return false;
    }
  }, [user]);

  return {
    archivedQuotations,
    loading,
    isAdmin,
    archiveQuotation,
    permanentlyDeleteQuotation,
    restoreQuotation,
    refreshArchivedQuotations: fetchArchivedQuotations,
  };
};
