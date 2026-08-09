import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateTotal, formatDate } from '@/lib/quotation-utils';
import { FileText, CheckCircle2, Clock, Package, TrendingUp, XCircle } from 'lucide-react';

export interface PortalQuoteRow {
  id: string;
  quote_number: string;
  created_at: string;
  valid_until: string;
  status: string | null;
  currency: string;
  items: any;
  tax_rate: number | null;
  discount_type: string | null;
  discount_value: number | null;
  ordered_items?: any;
}

const ORDER_STATUSES = ['accepted', 'finished'];

const quoteTotal = (q: PortalQuoteRow) =>
  calculateTotal(
    Array.isArray(q.items) ? q.items : [],
    q.tax_rate || 0,
    (q.discount_type as any) || 'percentage',
    q.discount_value || 0
  );

const fmtMoney = (v: number, ccy: string) =>
  `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

export const PortalStats = ({ quotes }: { quotes: PortalQuoteRow[] }) => {
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const valueByCurrency: Record<string, number> = {};
    const orderValueByCurrency: Record<string, number> = {};
    const itemCount: Record<string, { qty: number; description: string }> = {};
    const monthly: Record<string, { quotes: number; orders: number }> = {};

    quotes.forEach((q) => {
      const st = (q.status || 'draft').toLowerCase();
      byStatus[st] = (byStatus[st] || 0) + 1;
      const total = quoteTotal(q);
      valueByCurrency[q.currency] = (valueByCurrency[q.currency] || 0) + total;
      if (ORDER_STATUSES.includes(st)) {
        orderValueByCurrency[q.currency] = (orderValueByCurrency[q.currency] || 0) + total;
      }
      const key = new Date(q.created_at).toISOString().slice(0, 7);
      if (!monthly[key]) monthly[key] = { quotes: 0, orders: 0 };
      monthly[key].quotes += 1;
      if (ORDER_STATUSES.includes(st)) monthly[key].orders += 1;

      (Array.isArray(q.items) ? q.items : []).forEach((it: any) => {
        const sku = it?.sku || it?.description?.slice(0, 24) || 'Item';
        if (!itemCount[sku]) itemCount[sku] = { qty: 0, description: it?.description || '' };
        itemCount[sku].qty += Number(it?.quantity) || 0;
      });
    });

    const orders = quotes.filter((q) => ORDER_STATUSES.includes((q.status || '').toLowerCase()));
    const topItems = Object.entries(itemCount)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);
    const months = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    const maxMonth = Math.max(1, ...months.map(([, m]) => m.quotes));

    return {
      total: quotes.length,
      orders: orders.length,
      pending: quotes.filter((q) => ['sent', 'draft'].includes((q.status || 'draft').toLowerCase())).length,
      declined: byStatus['declined'] || 0,
      valueByCurrency,
      orderValueByCurrency,
      conversion: quotes.length ? Math.round((orders.length / quotes.length) * 100) : 0,
      topItems,
      months,
      maxMonth,
      lastQuote: quotes[0] || null,
    };
  }, [quotes]);

  const Stat = ({ icon: Icon, label, value, sub }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );

  if (!quotes.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          No activity yet — statistics will appear once quotations are issued.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileText} label="Total quotations" value={stats.total} />
        <Stat icon={Package} label="Orders placed" value={stats.orders} sub={`${stats.conversion}% conversion`} />
        <Stat icon={Clock} label="Open / pending" value={stats.pending} />
        <Stat icon={XCircle} label="Declined" value={stats.declined} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <TrendingUp className="w-4 h-4" /> Total quoted value
            </div>
            <div className="space-y-1">
              {Object.entries(stats.valueByCurrency).map(([ccy, v]) => (
                <div key={ccy} className="text-lg font-semibold">{fmtMoney(v, ccy)}</div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <CheckCircle2 className="w-4 h-4" /> Ordered value
            </div>
            <div className="space-y-1">
              {Object.keys(stats.orderValueByCurrency).length === 0 && (
                <div className="text-sm text-muted-foreground">No orders yet</div>
              )}
              {Object.entries(stats.orderValueByCurrency).map(([ccy, v]) => (
                <div key={ccy} className="text-lg font-semibold">{fmtMoney(v, ccy)}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Activity (last 6 months)</p>
            <div className="flex items-end gap-3 h-32">
              {stats.months.map(([month, m]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-24">
                    <div
                      className="w-3 rounded-t bg-primary/70"
                      style={{ height: `${(m.quotes / stats.maxMonth) * 100}%` }}
                      title={`${m.quotes} quotations`}
                    />
                    <div
                      className="w-3 rounded-t bg-primary"
                      style={{ height: `${(m.orders / stats.maxMonth) * 100}%` }}
                      title={`${m.orders} orders`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{month.slice(5)}/{month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/70" /> Quotations</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" /> Orders</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Most requested items</p>
            <div className="space-y-2">
              {stats.topItems.map(([sku, info]) => (
                <div key={sku} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{sku}</div>
                    <div className="text-xs text-muted-foreground truncate">{info.description}</div>
                  </div>
                  <Badge variant="secondary">{info.qty} pcs</Badge>
                </div>
              ))}
            </div>
            {stats.lastQuote && (
              <p className="text-xs text-muted-foreground mt-4">
                Last quotation {stats.lastQuote.quote_number} — {formatDate(new Date(stats.lastQuote.created_at))}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
