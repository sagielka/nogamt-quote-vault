import { useState, useCallback, useEffect } from 'react';
import { Quotation, QuotationFormData } from '@/types/quotation';
import { generateQuoteNumber } from '@/lib/quotation-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'quotations';

// Helper to convert database row to Quotation type
const dbRowToQuotation = (row: any): Quotation => ({
  id: row.id,
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
  reminderSentAt: row.reminder_sent_at ? new Date(row.reminder_sent_at) : null,
});

// Helper to convert QuotationFormData to database insert format
const quotationToDbRow = (data: QuotationFormData, userId: string, quoteNumber: string) => ({
  user_id: userId,
  quote_number: quoteNumber,
  client_name: data.clientName,
  client_email: data.clientEmail,
  client_address: data.clientAddress || null,
  items: data.items,
  tax_rate: data.taxRate,
  discount_type: data.discountType,
  discount_value: data.discountValue,
  notes: data.notes || null,
  currency: data.currency,
  status: data.status || 'draft',
  attachments: data.attachments || [],
  valid_until: data.validUntil.toISOString(),
});

export const useQuotations = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Fetch quotations from database
  const fetchQuotations = useCallback(async () => {
    if (!user) {
      setQuotations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotations:', error);
        setQuotations([]);
      } else if (data) {
        setQuotations(data.map(dbRowToQuotation));
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Migrate data from localStorage to database (one-time)
  const migrateLocalStorageData = useCallback(async () => {
    if (!user) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      console.log(`Migrating ${parsed.length} quotations from localStorage to database...`);

      for (const quote of parsed) {
        const dbRow = {
          user_id: user.id,
          quote_number: quote.quoteNumber || generateQuoteNumber(quote.clientName || ''),
          client_name: quote.clientName,
          client_email: quote.clientEmail,
          client_address: quote.clientAddress || null,
          items: quote.items || [],
          tax_rate: quote.taxRate || 0,
          discount_type: quote.discountType || 'percentage',
          discount_value: quote.discountValue || 0,
          notes: quote.notes || null,
          currency: quote.currency || 'USD',
          status: quote.status || 'draft',
          attachments: quote.attachments || [],
          valid_until: quote.validUntil ? new Date(quote.validUntil).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const { error } = await supabase.from('quotations').insert(dbRow);
        if (error) {
          console.error('Error migrating quotation:', error);
        }
      }

      // Remove localStorage data after successful migration
      localStorage.removeItem(STORAGE_KEY);
      console.log('Migration complete, localStorage cleared');
      
      // Refresh quotations from database
      await fetchQuotations();
    } catch (err) {
      console.error('Error during migration:', err);
    }
  }, [user, fetchQuotations]);

  // Load quotations when user changes
  useEffect(() => {
    if (user) {
      fetchQuotations().then(() => {
        migrateLocalStorageData();
      });
    } else {
      setQuotations([]);
      setLoading(false);
    }
  }, [user, fetchQuotations, migrateLocalStorageData]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('quotations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotations',
        },
        (payload) => {
          console.log('Quotations realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            const newQuotation = dbRowToQuotation(payload.new);
            setQuotations((prev) => {
              // Avoid duplicates
              if (prev.some((q) => q.id === newQuotation.id)) return prev;
              return [newQuotation, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedQuotation = dbRowToQuotation(payload.new);
            setQuotations((prev) =>
              prev.map((q) => (q.id === updatedQuotation.id ? updatedQuotation : q))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setQuotations((prev) => prev.filter((q) => q.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const addQuotation = useCallback(async (data: QuotationFormData): Promise<Quotation | null> => {
    if (!user) return null;

    // Get existing quote numbers to determine next index
    const existingQuoteNumbers = quotations.map(q => q.quoteNumber);
    const quoteNumber = generateQuoteNumber(data.clientName, existingQuoteNumbers);
    const dbRow = quotationToDbRow(data, user.id, quoteNumber);

    try {
      const { data: newRow, error } = await supabase
        .from('quotations')
        .insert(dbRow as any)
        .select()
        .single();

      if (error) {
        console.error('Error adding quotation:', error);
        return null;
      }

      const newQuotation = dbRowToQuotation(newRow);
      setQuotations((prev) => [newQuotation, ...prev]);
      return newQuotation;
    } catch (err) {
      console.error('Error adding quotation:', err);
      return null;
    }
  }, [user, quotations]);

  const updateQuotation = useCallback(async (id: string, data: Partial<QuotationFormData>) => {
    if (!user) return;

    // Find the existing quotation to check if client name changed
    const existingQuotation = quotations.find((q) => q.id === id);

    const updateData: any = {};
    
    // If a custom quote number is provided, use it directly
    if (data.quoteNumber !== undefined && data.quoteNumber) {
      updateData.quote_number = data.quoteNumber;
    } else {
      // Check if this is a COPY quote (ends with -COPY)
      const isCopyQuote = existingQuotation?.quoteNumber?.endsWith('-COPY');
      
      // If client name changed OR this is a COPY quote being updated, regenerate quote number (without -COPY)
      if (data.clientName !== undefined && existingQuotation && (data.clientName !== existingQuotation.clientName || isCopyQuote)) {
        // Get existing quote numbers (excluding the current one being updated)
        const existingQuoteNumbers = quotations.filter(q => q.id !== id).map(q => q.quoteNumber);
        updateData.quote_number = generateQuoteNumber(data.clientName, existingQuoteNumbers, false);
      }
    }
    
    if (data.clientName !== undefined) updateData.client_name = data.clientName;
    if (data.clientEmail !== undefined) {
      updateData.client_email = data.clientEmail;
      // Reset reminder when email changes so user can send again
      if (existingQuotation && data.clientEmail !== existingQuotation.clientEmail) {
        updateData.reminder_sent_at = null;
      }
    }
    if (data.clientAddress !== undefined) updateData.client_address = data.clientAddress || null;
    if (data.items !== undefined) updateData.items = data.items;
    if (data.taxRate !== undefined) updateData.tax_rate = data.taxRate;
    if (data.discountType !== undefined) updateData.discount_type = data.discountType;
    if (data.discountValue !== undefined) updateData.discount_value = data.discountValue;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;
    if (data.validUntil !== undefined) updateData.valid_until = data.validUntil.toISOString();

    try {
      const { error } = await supabase
        .from('quotations')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating quotation:', error);
        return;
      }

      // Update local state with new quote number if it was regenerated
      const updatedData = updateData.quote_number 
        ? { ...data, quoteNumber: updateData.quote_number }
        : data;

      setQuotations((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updatedData } : q))
      );
    } catch (err) {
      console.error('Error updating quotation:', err);
    }
  }, [user, quotations]);

  const deleteQuotation = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting quotation:', error);
        return;
      }

      setQuotations((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      console.error('Error deleting quotation:', err);
    }
  }, [user]);

  const getQuotation = useCallback((id: string): Quotation | undefined => {
    return quotations.find((q) => q.id === id);
  }, [quotations]);

  const duplicateQuotation = useCallback(async (id: string): Promise<Quotation | null> => {
    if (!user) return null;
    
    const original = quotations.find((q) => q.id === id);
    if (!original) return null;

    // Get existing quote numbers to determine next index
    const existingQuoteNumbers = quotations.map(q => q.quoteNumber);
    const quoteNumber = generateQuoteNumber(original.clientName, existingQuoteNumbers, true);
    const dbRow = {
      user_id: user.id,
      quote_number: quoteNumber,
      client_name: original.clientName,
      client_email: original.clientEmail,
      client_address: original.clientAddress || null,
      items: original.items,
      tax_rate: original.taxRate,
      discount_type: original.discountType,
      discount_value: original.discountValue,
      notes: original.notes || null,
      currency: original.currency,
      status: 'draft',
      attachments: [],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      const { data: newRow, error } = await supabase
        .from('quotations')
        .insert(dbRow as any)
        .select()
        .single();

      if (error) {
        console.error('Error duplicating quotation:', error);
        return null;
      }

      const newQuotation = dbRowToQuotation(newRow);
      setQuotations((prev) => [newQuotation, ...prev]);
      return newQuotation;
    } catch (err) {
      console.error('Error duplicating quotation:', err);
      return null;
    }
  }, [user, quotations]);

  return {
    quotations,
    loading,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    duplicateQuotation,
    getQuotation,
    refreshQuotations: fetchQuotations,
  };
};
