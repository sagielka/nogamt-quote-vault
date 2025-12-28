import { useState, useCallback } from 'react';
import { Quotation, QuotationFormData } from '@/types/quotation';
import { generateQuoteNumber } from '@/lib/quotation-utils';

const STORAGE_KEY = 'quotations';

const loadFromStorage = (): Quotation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((q: any) => ({
        ...q,
        createdAt: new Date(q.createdAt),
        validUntil: new Date(q.validUntil),
        currency: q.currency || 'USD',
      }));
    }
  } catch (e) {
    console.error('Failed to load quotations:', e);
  }
  return [];
};

const saveToStorage = (quotations: Quotation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotations));
};

export const useQuotations = () => {
  const [quotations, setQuotations] = useState<Quotation[]>(loadFromStorage);

  const addQuotation = useCallback((data: QuotationFormData): Quotation => {
    const newQuotation: Quotation = {
      ...data,
      id: crypto.randomUUID(),
      quoteNumber: generateQuoteNumber(),
      createdAt: new Date(),
    };
    
    setQuotations((prev) => {
      const updated = [newQuotation, ...prev];
      saveToStorage(updated);
      return updated;
    });
    
    return newQuotation;
  }, []);

  const updateQuotation = useCallback((id: string, data: Partial<QuotationFormData>) => {
    setQuotations((prev) => {
      const updated = prev.map((q) =>
        q.id === id ? { ...q, ...data } : q
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const deleteQuotation = useCallback((id: string) => {
    setQuotations((prev) => {
      const updated = prev.filter((q) => q.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const getQuotation = useCallback((id: string): Quotation | undefined => {
    return quotations.find((q) => q.id === id);
  }, [quotations]);

  return {
    quotations,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    getQuotation,
  };
};
