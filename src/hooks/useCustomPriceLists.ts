import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomPriceList {
  id: string;
  name: string;
  currency: string;
  source_file: string | null;
  created_at: string;
  item_count?: number;
}

export interface CustomPriceRow {
  sku: string;
  description: string | null;
  price: number;
}

export const CUSTOM_PREFIX = 'custom:';

export const useCustomPriceLists = () => {
  const [lists, setLists] = useState<CustomPriceList[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('custom_price_lists' as any)
      .select('*, custom_price_list_items(count)')
      .order('created_at', { ascending: false }) as any);
    setLists(
      ((data || []) as any[]).map((l) => ({
        ...l,
        item_count: l.custom_price_list_items?.[0]?.count ?? 0,
      })) as CustomPriceList[]
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createList = useCallback(
    async (name: string, currency: string, sourceFile: string | null, rows: CustomPriceRow[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase
        .from('custom_price_lists' as any)
        .insert({ name, currency, source_file: sourceFile, created_by: userData.user?.id } as any)
        .select()
        .single() as any);
      if (error) throw new Error(error.message);

      const listId = (data as any).id as string;
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((r) => ({ ...r, list_id: listId }));
        const { error: itemErr } = await (supabase
          .from('custom_price_list_items' as any)
          .insert(chunk as any) as any);
        if (itemErr) throw new Error(itemErr.message);
      }
      await load();
      return listId;
    },
    [load]
  );

  const deleteList = useCallback(
    async (id: string) => {
      const { error } = await (supabase.from('custom_price_lists' as any).delete().eq('id', id) as any);
      if (error) throw new Error(error.message);
      await load();
    },
    [load]
  );

  return { lists, loading, reload: load, createList, deleteList };
};

export const fetchCustomPriceListItems = async (listId: string) => {
  const { data } = await (supabase
    .from('custom_price_list_items' as any)
    .select('sku, description, price')
    .eq('list_id', listId)
    .order('sku', { ascending: true }) as any);
  return (data || []) as CustomPriceRow[];
};

export const fetchCustomPriceList = async (listId: string) => {
  const { data } = await (supabase
    .from('custom_price_lists' as any)
    .select('*')
    .eq('id', listId)
    .maybeSingle() as any);
  return (data || null) as CustomPriceList | null;
};
