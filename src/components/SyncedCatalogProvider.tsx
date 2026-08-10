import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setSyncedCatalogPrices, type ProductItem } from '@/data/product-catalog';

/**
 * Loads catalog prices synced from Google Drive (table: catalog_prices)
 * and applies them on top of the built-in catalog.
 */
export const SyncedCatalogProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('catalog_prices')
        .select('sku, description, euro, dollar, shekel, noga_bv_euro, china_dollar');

      if (error || !data || cancelled) {
        if (error) console.warn('[SyncedCatalog] Could not load synced prices:', error.message);
        return;
      }

      const items: ProductItem[] = data.map((r) => ({
        sku: r.sku,
        description: r.description ?? r.sku,
        prices: {
          EURO: r.euro,
          DOLLAR: r.dollar,
          SHEKEL: r.shekel,
          NOGA_BV_EURO: r.noga_bv_euro,
          CHINA_DOLLAR: r.china_dollar,
        },
      }));

      setSyncedCatalogPrices(items);
      console.log(`[SyncedCatalog] Applied ${items.length} synced products`);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
};

export default SyncedCatalogProvider;
