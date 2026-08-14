import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateTotal, formatDate } from '@/lib/quotation-utils';
import { FileText, CheckCircle2, Clock, Package, TrendingUp, XCircle, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  accepted: '#22c55e',
  declined: '#ef4444',
  finished: '#f59e0b',
};
const CHART_COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

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

const isOrder = (q: PortalQuoteRow) => {
  const st = (q.status || '').toLowerCase();
  if (st === 'accepted') return true;
  const ordered = q.ordered_items;
  return st === 'finished' && Array.isArray(ordered) && ordered.length > 0;
};

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
    const statusValue: Record<string, Record<string, number>> = {};

    quotes.forEach((q) => {
      const st = (q.status || 'draft').toLowerCase();
      byStatus[st] = (byStatus[st] || 0) + 1;
      const total = quoteTotal(q);
      valueByCurrency[q.currency] = (valueByCurrency[q.currency] || 0) + total;
      if (!statusValue[st]) statusValue[st] = {};
      statusValue[st][q.currency] = (statusValue[st][q.currency] || 0) + total;
      if (isOrder(q)) {
        orderValueByCurrency[q.currency] = (orderValueByCurrency[q.currency] || 0) + total;
      }
      const key = new Date(q.created_at).toISOString().slice(0, 7);
      if (!monthly[key]) monthly[key] = { quotes: 0, orders: 0 };
      monthly[key].quotes += 1;
      if (isOrder(q)) monthly[key].orders += 1;

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

    const currencies = Object.keys(valueByCurrency);
    const statusData = Object.entries(byStatus).map(([status, count]) => ({ status, count }));
    const valueByStatus = Object.entries(statusValue).map(([status, m]) => ({ status, ...m }));
    const topItemsChart = Object.entries(itemCount)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([sku, info]) => ({ sku, qty: info.qty }));
    const trend = Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, m]) => ({ month, quotations: m.quotes, orders: m.orders }));
    const avgOrder = orders.length
      ? Object.entries(orderValueByCurrency).map(([ccy, v]) => fmtMoney(v / orders.length, ccy)).join(' · ')
      : '—';

    return {
      currencies,
      statusData,
      valueByStatus,
      topItemsChart,
      trend,
      avgOrder,
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
        <Stat icon={TrendingUp} label="Average order value" value={<span className="text-lg">{stats.avgOrder}</span>} />
        <Stat
          icon={CheckCircle2}
          label="Last quotation"
          value={<span className="text-lg">{stats.lastQuote?.quote_number || '—'}</span>}
          sub={stats.lastQuote ? formatDate(new Date(stats.lastQuote.created_at)) : undefined}
        />
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <PieChartIcon className="w-4 h-4" /> Status distribution
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.statusData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label={({ status, count }: any) => `${status} (${count})`}
                >
                  {stats.statusData.map((entry, i) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <BarChart3 className="w-4 h-4" /> Value by status (per currency)
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.valueByStatus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <Legend />
                {stats.currencies.map((cur, i) => (
                  <Bar key={cur} dataKey={cur} name={cur} stackId="value" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <LineChartIcon className="w-4 h-4" /> Quotations & orders over time
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="quotations" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="orders" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
              <Package className="w-4 h-4" /> Top 10 products by quantity
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.topItemsChart} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="sku" width={110} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qty" name="Quantity" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
