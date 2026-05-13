import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Tag } from 'lucide-react';
import { getProductCatalog } from '@/data/product-catalog';

const fmt = (v: number | null, symbol: string) => {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface Props {
  defaultOpen?: boolean;
  compact?: boolean;
}

export const ItemPricesView = ({ defaultOpen = true, compact = false }: Props) => {
  const [query, setQuery] = useState('');
  const catalog = useMemo(() => getProductCatalog(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, compact ? 50 : 200);
    return catalog
      .filter(p => p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .slice(0, compact ? 50 : 200);
  }, [query, catalog, compact]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-primary" />
        <h3 className="heading-display text-lg text-foreground">Item Prices</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {catalog.length}
        </span>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by SKU or description…"
          className="pl-9"
        />
      </div>
      <div className="max-h-[132px] overflow-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">EUR</th>
              <th className="px-3 py-2 font-medium text-right">USD</th>
              <th className="px-3 py-2 font-medium text-right">ILS</th>
              <th className="px-3 py-2 font-medium text-right">BV EUR</th>
              <th className="px-3 py-2 font-medium text-right">CN $</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.sku} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 font-mono text-xs">{p.sku}</td>
                <td className="px-3 py-1.5">{p.description}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.prices.EURO, '€')}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.prices.DOLLAR, '$')}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.prices.SHEKEL, '₪')}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.prices.NOGA_BV_EURO, '€')}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.prices.CHINA_DOLLAR, '$')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ItemPricesView;
