import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

// Shared, user-approved manual cost overrides (stored in USD, keyed by SKU).
// These take precedence over the static cost table.

const overrides: Record<string, number> = {};
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

export const normalizeSku = (sku: string) =>
  (sku || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toUpperCase();

export const getCostOverrideUsd = (sku: string): number | null => {
  const key = normalizeSku(sku);
  if (!key) return null;
  const v = overrides[key];
  return v != null && v > 0 ? v : null;
};

const notify = () => listeners.forEach((l) => l());

export const loadCostOverrides = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = (async () => {
      const { data, error } = await supabase
        .from('product_cost_overrides')
        .select('sku, cost_usd');
      if (error) {
        console.error('Error loading cost overrides:', error);
        return;
      }
      for (const row of data || []) {
        overrides[normalizeSku(row.sku)] = Number(row.cost_usd);
      }
      notify();
    })();
  }
  return loadPromise;
};

export const saveCostOverride = async (
  sku: string,
  costUsd: number,
  userId: string,
): Promise<{ error: string | null }> => {
  const key = normalizeSku(sku);
  if (!key) return { error: 'Missing SKU' };
  const { error } = await supabase
    .from('product_cost_overrides')
    .upsert(
      { sku: key, cost_usd: costUsd, created_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'sku' },
    );
  if (error) return { error: error.message };
  overrides[key] = costUsd;
  notify();
  return { error: null };
};

// Subscribe a component to override changes (and trigger the initial load).
export const useCostOverrides = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    loadCostOverrides();
    return () => {
      listeners.delete(listener);
    };
  }, []);
};
