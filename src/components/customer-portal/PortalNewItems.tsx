import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { productCatalog, type PriceList } from '@/data/product-catalog';
import type { CustomPriceRow } from '@/hooks/useCustomPriceLists';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';
import { ProductMediaThumb } from '@/components/product-media/ProductMediaThumb';

interface NewRow {
  sku: string;
  description: string;
  price: number | null;
  euroPrice: number | null;
  createdAt: string;
}

interface Props {
  priceList: PriceList | null;
  customListId: string | null;
  customRows: CustomPriceRow[];
  symbol: string;
}

const COLUMN: Record<PriceList, string> = {
  EURO: 'euro',
  DOLLAR: 'dollar',
  SHEKEL: 'shekel',
  NOGA_BV_EURO: 'noga_bv_euro',
  CHINA_DOLLAR: 'china_dollar',
};

export const PortalNewItems = ({ priceList, customListId, customRows, symbol }: Props) => {
  const [rows, setRows] = useState<NewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showEuroCompare = !customListId && priceList === 'NOGA_BV_EURO';

  const legacySkus = useMemo(
    () => new Set(productCatalog.map((p) => p.sku.toUpperCase())),
    []
  );
  const customMap = useMemo(() => {
    const m = new Map<string, CustomPriceRow>();
    customRows.forEach((r) => m.set(r.sku.toUpperCase(), r));
    return m;
  }, [customRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('catalog_prices')
        .select('sku, description, euro, dollar, shekel, noga_bv_euro, china_dollar, created_at')
        .order('created_at', { ascending: false });
      if (cancelled) return;

      const col = priceList ? COLUMN[priceList] : null;
      const fresh: NewRow[] = ((data as any[]) || [])
        .filter((r) => !legacySkus.has(String(r.sku).toUpperCase()))
        .map((r) => {
          const custom = customMap.get(String(r.sku).toUpperCase());
          const price = customListId
            ? custom
              ? Number(custom.price)
              : null
            : col
              ? (r[col] as number | null)
              : null;
          return {
            sku: r.sku,
            description: r.description || r.sku,
            price,
            euroPrice: r.euro == null ? null : Number(r.euro),
            createdAt: r.created_at,
          };
        })
        .filter((r) => (customListId ? r.price != null : r.price != null))
        .slice(0, 120);

      setRows(fresh);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [priceList, customListId, legacySkus, customMap]);

  const fmt = (v: number) =>
    `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading new items…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          No new catalog items since your last price list update.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <Card key={r.sku} className="overflow-hidden">
          <CardContent className="p-4 flex gap-3 items-start">
            <ProductMediaThumb sku={r.sku} description={r.description} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold">{r.sku}</span>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Sparkles className="w-3 h-3" /> New
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
              {r.price != null && (
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-primary">{fmt(r.price)}</p>
                  {showEuroCompare && (
                    <span className="text-xs text-muted-foreground">
                      Euro list{' '}
                      {r.euroPrice == null
                        ? '—'
                        : `€${r.euroPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
