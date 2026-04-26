import { useMemo, useState } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, isWithinInterval } from 'date-fns';
import { Quotation } from '@/types/quotation';
import { calculateTotal, calculateLineTotal, calculateSubtotal, formatCurrency } from '@/lib/quotation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, DollarSign, Clock, CheckCircle, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Users, Package, Layers, CalendarIcon, X, Download, Percent } from 'lucide-react';
import { LineChart, Line } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface QuotationStatsProps {
  quotations: Quotation[];
  isAdmin?: boolean;
  userNameMap?: Record<string, string>;
  onFilterExpiring?: () => void;
  expiringSoonActive?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  sent: 'hsl(210, 80%, 55%)',
  accepted: 'hsl(152, 60%, 45%)',
  declined: 'hsl(0, 70%, 55%)',
};

const USER_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(152, 60%, 45%)',
  'hsl(35, 90%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(0, 70%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(60, 70%, 45%)',
  'hsl(320, 60%, 55%)',
];

type PresetRange = 'all' | '7d' | '30d' | '90d' | 'this-month' | 'last-month' | 'this-year' | 'custom';

const getPresetDates = (preset: PresetRange): { from: Date | undefined; to: Date | undefined } => {
  const now = new Date();
  switch (preset) {
    case '7d': return { from: subDays(now, 7), to: now };
    case '30d': return { from: subDays(now, 30), to: now };
    case '90d': return { from: subDays(now, 90), to: now };
    case 'this-month': return { from: startOfMonth(now), to: now };
    case 'last-month': {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case 'this-year': return { from: startOfYear(now), to: now };
    default: return { from: undefined, to: undefined };
  }
};

export const QuotationStats = ({ quotations, isAdmin, userNameMap = {}, onFilterExpiring, expiringSoonActive }: QuotationStatsProps) => {
  const [chartsOpen, setChartsOpen] = useState(false);
  const [rangePreset, setRangePreset] = useState<PresetRange>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const dateRange = useMemo(() => {
    if (rangePreset === 'custom') return { from: customFrom, to: customTo };
    if (rangePreset === 'all') return { from: undefined, to: undefined };
    return getPresetDates(rangePreset);
  }, [rangePreset, customFrom, customTo]);

  const filteredQuotations = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return quotations;
    return quotations.filter(q => {
      const created = new Date(q.createdAt);
      if (dateRange.from && dateRange.to) {
        return isWithinInterval(created, { start: dateRange.from, end: dateRange.to });
      }
      if (dateRange.from) return created >= dateRange.from;
      if (dateRange.to) return created <= dateRange.to;
      return true;
    });
  }, [quotations, dateRange]);

  const stats = useMemo(() => {
    const total = filteredQuotations.length;
    const byStatus = {
      draft: filteredQuotations.filter(q => q.status === 'draft').length,
      sent: filteredQuotations.filter(q => q.status === 'sent').length,
      accepted: filteredQuotations.filter(q => q.status === 'accepted').length,
      declined: filteredQuotations.filter(q => q.status === 'declined').length,
    };

    // Group values by currency to avoid mixing different currencies (e.g. ILS + USD)
    const totalValueByCurrency: Record<string, number> = {};
    const acceptedValueByCurrency: Record<string, number> = {};
    filteredQuotations.forEach(q => {
      const cur = (q.currency || 'USD') as string;
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      totalValueByCurrency[cur] = (totalValueByCurrency[cur] || 0) + val;
      if (q.status === 'accepted') {
        acceptedValueByCurrency[cur] = (acceptedValueByCurrency[cur] || 0) + val;
      }
    });
    // Keep scalar fallbacks (dominant currency only) for places that still need a single number
    const totalValue = 0;
    const acceptedValue = 0;

    const conversionRate = total > 0 ? ((byStatus.accepted / total) * 100) : 0;

    const now = new Date();
    const expiringSoon = filteredQuotations.filter(q => {
      if (q.status === 'accepted' || q.status === 'declined' || q.status === 'finished') return false;
      const validUntil = new Date(q.validUntil);
      const daysLeft = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 7;
    }).length;

    const currencyCounts: Record<string, number> = {};
    filteredQuotations.forEach(q => {
      currencyCounts[q.currency] = (currencyCounts[q.currency] || 0) + 1;
    });
    const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    return { total, byStatus, totalValue, acceptedValue, conversionRate, expiringSoon, dominantCurrency, totalValueByCurrency, acceptedValueByCurrency };
  }, [filteredQuotations]);

  // Monthly trend data
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; draft: number; sent: number; accepted: number; declined: number; total: number }> = {};
    
    filteredQuotations.forEach(q => {
      const date = new Date(q.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      if (!months[key]) {
        months[key] = { month: label, draft: 0, sent: 0, accepted: 0, declined: 0, total: 0 };
      }
      months[key][q.status as 'draft' | 'sent' | 'accepted' | 'declined'] += 1;
      months[key].total += 1;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v);
  }, [filteredQuotations]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    return [
      { name: 'Draft', value: stats.byStatus.draft, color: STATUS_COLORS.draft },
      { name: 'Sent', value: stats.byStatus.sent, color: STATUS_COLORS.sent },
      { name: 'Accepted', value: stats.byStatus.accepted, color: STATUS_COLORS.accepted },
      { name: 'Declined', value: stats.byStatus.declined, color: STATUS_COLORS.declined },
    ].filter(d => d.value > 0);
  }, [stats.byStatus]);

  // Per-user breakdown
  const perUserStats = useMemo(() => {
    if (!isAdmin) return [];

    const byUser: Record<string, { total: number; draft: number; sent: number; accepted: number; declined: number; totalValue: number; acceptedValue: number }> = {};

    filteredQuotations.forEach(q => {
      const uid = q.userId;
      if (!byUser[uid]) {
        byUser[uid] = { total: 0, draft: 0, sent: 0, accepted: 0, declined: 0, totalValue: 0, acceptedValue: 0 };
      }
      byUser[uid].total += 1;
      byUser[uid][q.status as 'draft' | 'sent' | 'accepted' | 'declined'] += 1;
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      byUser[uid].totalValue += val;
      if (q.status === 'accepted') {
        byUser[uid].acceptedValue += val;
      }
    });

    return Object.entries(byUser)
      .map(([userId, data]) => ({
        userId,
        name: userNameMap[userId] || userId.slice(0, 6),
        ...data,
        conversionRate: data.total > 0 ? (data.accepted / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredQuotations, isAdmin, userNameMap]);

  // Per-user bar chart data
  const perUserChartData = useMemo(() => {
    return perUserStats.map(u => ({
      name: u.name,
      Accepted: u.accepted,
      Sent: u.sent,
      Draft: u.draft,
      Declined: u.declined,
    }));
  }, [perUserStats]);

  // Family name mapping
  const FAMILY_NAMES: Record<string, string> = {
    US: 'USPOT',
    UC: 'UCHAMF',
    UF: 'UFIBER',
    UX: 'UX',
    UB: 'UBURR',
    CA: 'CATALOGS',
    UP: 'UPON ORDER',
  };

  // Extract family prefix from SKU (first 2 letters, e.g. US, UC, UF)
  // For "UPON ORDER" SKUs, inspect the description to determine the real family
  const getFamily = (sku: string, description?: string): string => {
    const clean = sku.trim().toUpperCase();
    // "UPON ORDER" SKUs → check description for family prefix
    if (clean.startsWith('UPON') && description) {
      const descClean = description.trim().toUpperCase();
      const descMatch = descClean.match(/^([A-Z]{2})/);
      if (descMatch) {
        const code = descMatch[1];
        return FAMILY_NAMES[code] || code;
      }
      return 'UPON ORDER';
    }
    const match = clean.match(/^([A-Z]{2})/);
    const code = match ? match[1] : 'Other';
    return FAMILY_NAMES[code] || code;
  };

  // Product family breakdown (split by currency to avoid mixing values)
  const familyStats = useMemo(() => {
    const families: Record<string, { family: string; currency: string; qty: number; value: number; quotations: Set<string> }> = {};

    filteredQuotations.forEach(q => {
      const cur = (q.currency || 'USD') as string;
      q.items.forEach(item => {
        const family = getFamily(item.sku, item.description);
        const key = `${family}__${cur}`;
        if (!families[key]) {
          families[key] = { family, currency: cur, qty: 0, value: 0, quotations: new Set() };
        }
        families[key].qty += item.moq;
        families[key].value += calculateLineTotal(item);
        families[key].quotations.add(q.id);
      });
    });

    return Object.values(families)
      .map(data => ({
        family: data.family,
        currency: data.currency,
        qty: data.qty,
        value: data.value,
        quoteCount: data.quotations.size,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredQuotations]);

  // Family pie chart data — aggregate qty across currencies (qty is unit count, currency-agnostic)
  const familyPieData = useMemo(() => {
    const colors = [
      'hsl(210, 80%, 55%)', 'hsl(152, 60%, 45%)', 'hsl(35, 90%, 55%)',
      'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(180, 60%, 45%)',
      'hsl(60, 70%, 45%)', 'hsl(320, 60%, 55%)',
    ];
    const byFamily: Record<string, number> = {};
    familyStats.forEach(f => {
      byFamily[f.family] = (byFamily[f.family] || 0) + f.qty;
    });
    return Object.entries(byFamily)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [familyStats]);

  // Top items by quantity (split by currency to avoid mixing values)
  const topItems = useMemo(() => {
    const items: Record<string, { sku: string; description: string; currency: string; qty: number; value: number; quoteCount: Set<string> }> = {};

    filteredQuotations.forEach(q => {
      const cur = (q.currency || 'USD') as string;
      q.items.forEach(item => {
        const skuKey = item.sku.trim().toUpperCase();
        if (!skuKey) return;
        const key = `${skuKey}__${cur}`;
        if (!items[key]) {
          items[key] = { sku: item.sku, description: item.description, currency: cur, qty: 0, value: 0, quoteCount: new Set() };
        }
        items[key].qty += item.moq;
        items[key].value += calculateLineTotal(item);
        items[key].quoteCount.add(q.id);
      });
    });

    return Object.values(items)
      .map(i => ({ ...i, quoteCount: i.quoteCount.size }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 20);
  }, [filteredQuotations]);

  // Profit margin analytics
  const profitData = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let quotesWithCost = 0;

    const perQuote: { quoteNumber: string; clientName: string; revenue: number; cost: number; profit: number; margin: number; status: string }[] = [];
    const byCustomer: Record<string, { clientName: string; revenue: number; cost: number; quoteCount: number }> = {};

    filteredQuotations.forEach(q => {
      const revenue = calculateSubtotal(q.items);
      const cost = q.items.reduce((sum, item) => sum + (item.costPrice || 0) * item.moq, 0);
      const hasCost = q.items.some(item => (item.costPrice || 0) > 0);

      if (hasCost) {
        quotesWithCost++;
        totalRevenue += revenue;
        totalCost += cost;
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        perQuote.push({
          quoteNumber: q.quoteNumber.replace(/^QT/i, ''),
          clientName: q.clientName,
          revenue,
          cost,
          profit,
          margin,
          status: q.status,
        });

        const custKey = q.clientName.trim().toLowerCase();
        if (!byCustomer[custKey]) {
          byCustomer[custKey] = { clientName: q.clientName, revenue: 0, cost: 0, quoteCount: 0 };
        }
        byCustomer[custKey].revenue += revenue;
        byCustomer[custKey].cost += cost;
        byCustomer[custKey].quoteCount++;
      }
    });

    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const perCustomer = Object.values(byCustomer)
      .map(c => ({
        ...c,
        profit: c.revenue - c.cost,
        margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    return { totalRevenue, totalCost, totalProfit, overallMargin, quotesWithCost, perQuote, perCustomer };
  }, [filteredQuotations]);

  // Monthly profit trend
  const monthlyProfitData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; cost: number; profit: number }> = {};

    filteredQuotations.forEach(q => {
      const hasCost = q.items.some(item => (item.costPrice || 0) > 0);
      if (!hasCost) return;

      const date = new Date(q.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!months[key]) months[key] = { month: label, revenue: 0, cost: 0, profit: 0 };

      const revenue = calculateSubtotal(q.items);
      const cost = q.items.reduce((sum, item) => sum + (item.costPrice || 0) * item.moq, 0);
      months[key].revenue += revenue;
      months[key].cost += cost;
      months[key].profit += revenue - cost;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => ({ ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }));
  }, [filteredQuotations]);

  const exportCSV = () => {
    const rows: string[][] = [];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    // Summary
    rows.push(['=== SUMMARY ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Quotes', String(stats.total)]);
    Object.entries(stats.totalValueByCurrency).forEach(([cur, val]) => {
      rows.push([`Total Value (${cur})`, val.toFixed(2)]);
    });
    rows.push(['Orders Received', String(stats.byStatus.accepted)]);
    Object.entries(stats.acceptedValueByCurrency).forEach(([cur, val]) => {
      rows.push([`Accepted Value (${cur})`, val.toFixed(2)]);
    });
    rows.push(['Conversion Rate', `${stats.conversionRate.toFixed(1)}%`]);
    rows.push(['Pending (Sent)', String(stats.byStatus.sent)]);
    rows.push(['Drafts', String(stats.byStatus.draft)]);
    rows.push(['Declined', String(stats.byStatus.declined)]);
    rows.push(['Expiring Soon', String(stats.expiringSoon)]);
    rows.push([]);

    // Team performance
    if (isAdmin && perUserStats.length > 0) {
      rows.push(['=== TEAM PERFORMANCE ===']);
      rows.push(['User', 'Total', 'Draft', 'Sent', 'Accepted', 'Declined', 'Conv. %', 'Total Value', 'Accepted Value']);
      perUserStats.forEach(u => {
        rows.push([u.name, String(u.total), String(u.draft), String(u.sent), String(u.accepted), String(u.declined), `${u.conversionRate.toFixed(1)}%`, u.totalValue.toFixed(2), u.acceptedValue.toFixed(2)]);
      });
      rows.push([]);
    }

    // Product families
    if (familyStats.length > 0) {
      rows.push(['=== PRODUCT FAMILIES ===']);
      rows.push(['Family', 'Currency', 'Quantity', 'Quotes', 'Value']);
      familyStats.forEach(f => {
        rows.push([f.family, f.currency, String(f.qty), String(f.quoteCount), f.value.toFixed(2)]);
      });
      rows.push([]);
    }

    // Top items
    if (topItems.length > 0) {
      rows.push(['=== TOP ITEMS ===']);
      rows.push(['SKU', 'Description', 'Family', 'Currency', 'Quantity', 'In Quotes', 'Value']);
      topItems.forEach(item => {
        rows.push([item.sku, item.description, getFamily(item.sku, item.description), item.currency, String(item.qty), String(item.quoteCount), item.value.toFixed(2)]);
      });
    }

    const csv = rows.map(r => r.map(c => esc(c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotation-stats-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    {
      label: 'Total Quotes',
      value: stats.total,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Total Value',
      value: (() => {
        const entries = Object.entries(stats.totalValueByCurrency).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return formatCurrency(0, stats.dominantCurrency as any);
        return entries.map(([cur, val]) => formatCurrency(val, cur as any)).join(' · ');
      })(),
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Orders Received',
      value: stats.byStatus.accepted,
      subtitle: (() => {
        const entries = Object.entries(stats.acceptedValueByCurrency).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return formatCurrency(0, stats.dominantCurrency as any);
        return entries.map(([cur, val]) => formatCurrency(val, cur as any)).join(' · ');
      })(),
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: stats.conversionRate >= 50 ? 'text-emerald-500' : 'text-amber-500',
      bgColor: stats.conversionRate >= 50 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
    },
    {
      label: 'Pending',
      value: stats.byStatus.sent,
      subtitle: `${stats.byStatus.draft} drafts`,
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Expiring Soon',
      value: stats.expiringSoon,
      subtitle: 'within 7 days',
      icon: AlertTriangle,
      color: stats.expiringSoon > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: stats.expiringSoon > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
        {(['all', '7d', '30d', '90d', 'this-month', 'last-month', 'this-year', 'custom'] as PresetRange[]).map(preset => (
          <Button
            key={preset}
            variant={rangePreset === preset ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setRangePreset(preset)}
          >
            {{ all: 'All Time', '7d': '7 Days', '30d': '30 Days', '90d': '90 Days', 'this-month': 'This Month', 'last-month': 'Last Month', 'this-year': 'This Year', custom: 'Custom' }[preset]}
          </Button>
        ))}
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-1.5 ml-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs px-2.5 gap-1", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3 h-3" />
                  {customFrom ? format(customFrom, 'MMM d, yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs px-2.5 gap-1", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3 h-3" />
                  {customTo ? format(customTo, 'MMM d, yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
        {rangePreset !== 'all' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5" onClick={() => { setRangePreset('all'); setCustomFrom(undefined); setCustomTo(undefined); }}>
            <X className="w-3 h-3" />
          </Button>
        )}
        {rangePreset !== 'all' && (
          <span className="text-xs text-muted-foreground ml-1">
            Showing {filteredQuotations.length} of {quotations.length} quotations
          </span>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1 ml-auto" onClick={exportCSV}>
          <Download className="w-3 h-3" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const isExpiring = card.label === 'Expiring Soon';
          const isActive = isExpiring && expiringSoonActive;
          return (
            <Card
              key={card.label}
              className={cn(
                "overflow-hidden cursor-pointer transition-colors hover:bg-accent/50",
                isActive && "ring-2 ring-destructive bg-destructive/5"
              )}
              onClick={() => {
                if (isExpiring && onFilterExpiring) {
                  onFilterExpiring();
                } else {
                  setChartsOpen(!chartsOpen);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                    <p className={`text-lg font-bold ${card.color} truncate`}>
                      {card.value}
                    </p>
                    {card.subtitle && (
                      <p className="text-[10px] text-muted-foreground truncate">{card.subtitle}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Toggle charts */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChartsOpen(!chartsOpen)}
          className="text-xs text-muted-foreground gap-1"
        >
          {chartsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {chartsOpen ? 'Hide Charts' : 'Show Charts'}
        </Button>
      </div>

      {chartsOpen && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monthly trend bar chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Quotation Trends</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                          color: 'hsl(var(--foreground))',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="accepted" stackId="a" fill={STATUS_COLORS.accepted} name="Accepted" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="sent" stackId="a" fill={STATUS_COLORS.sent} name="Sent" />
                      <Bar dataKey="draft" stackId="a" fill={STATUS_COLORS.draft} name="Draft" />
                      <Bar dataKey="declined" stackId="a" fill={STATUS_COLORS.declined} name="Declined" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Status distribution pie chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: 11 }}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                          color: 'hsl(var(--foreground))',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-user breakdown (admin only) */}
          {isAdmin && perUserStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Per-user bar chart */}
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perUserChartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12,
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="Accepted" stackId="a" fill={STATUS_COLORS.accepted} />
                    <Bar dataKey="Sent" stackId="a" fill={STATUS_COLORS.sent} />
                    <Bar dataKey="Draft" stackId="a" fill={STATUS_COLORS.draft} />
                    <Bar dataKey="Declined" stackId="a" fill={STATUS_COLORS.declined} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Per-user table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">User</TableHead>
                        <TableHead className="text-xs text-center">Total</TableHead>
                        <TableHead className="text-xs text-center">Draft</TableHead>
                        <TableHead className="text-xs text-center">Sent</TableHead>
                        <TableHead className="text-xs text-center">Accepted</TableHead>
                        <TableHead className="text-xs text-center">Declined</TableHead>
                        <TableHead className="text-xs text-center">Conv. %</TableHead>
                        <TableHead className="text-xs text-right">Total Value</TableHead>
                        <TableHead className="text-xs text-right">Accepted Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perUserStats.map((u, i) => (
                        <TableRow key={u.userId}>
                          <TableCell className="text-xs font-medium">{u.name}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{u.total}</TableCell>
                          <TableCell className="text-xs text-center">{u.draft}</TableCell>
                          <TableCell className="text-xs text-center">{u.sent}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                              {u.accepted}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-center">{u.declined}</TableCell>
                          <TableCell className="text-xs text-center">
                            <span className={u.conversionRate >= 50 ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}>
                              {u.conversionRate.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {formatCurrency(u.totalValue, stats.dominantCurrency as any)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-emerald-600">
                            {formatCurrency(u.acceptedValue, stats.dominantCurrency as any)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Family & Item Stats */}
          {familyStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Product Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="family" className="w-full">
                  <TabsList className="mb-3">
                    <TabsTrigger value="family" className="text-xs gap-1">
                      <Layers className="w-3 h-3" /> Family Lines
                    </TabsTrigger>
                    <TabsTrigger value="items" className="text-xs gap-1">
                      <Package className="w-3 h-3" /> Top Items
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="family" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Family pie chart */}
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={familyPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                            style={{ fontSize: 11 }}
                          >
                            {familyPieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: 12,
                              color: 'hsl(var(--foreground))',
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number) => [`${value} units`, 'Quantity']}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Family table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Family</TableHead>
                              <TableHead className="text-xs text-center">Currency</TableHead>
                              <TableHead className="text-xs text-center">Qty</TableHead>
                              <TableHead className="text-xs text-center">Quotes</TableHead>
                              <TableHead className="text-xs text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {familyStats.map(f => (
                              <TableRow key={`${f.family}-${f.currency}`}>
                                <TableCell className="text-xs font-medium">
                                  <Badge variant="outline" className="text-[10px]">{f.family}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant="secondary" className="text-[10px]">{f.currency}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center font-bold">{f.qty}</TableCell>
                                <TableCell className="text-xs text-center">{f.quoteCount}</TableCell>
                                <TableCell className="text-xs text-right">
                                  {formatCurrency(f.value, f.currency as any)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="items">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-xs text-center">Family</TableHead>
                            <TableHead className="text-xs text-center">Currency</TableHead>
                            <TableHead className="text-xs text-center">Total Qty</TableHead>
                            <TableHead className="text-xs text-center">In Quotes</TableHead>
                            <TableHead className="text-xs text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topItems.map((item, i) => (
                            <TableRow key={`${item.sku}-${item.currency}`}>
                              <TableCell className="text-xs font-mono font-medium">{item.sku}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</TableCell>
                              <TableCell className="text-xs text-center">
                                <Badge variant="outline" className="text-[10px]">{getFamily(item.sku, item.description)}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                <Badge variant="secondary" className="text-[10px]">{item.currency}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-center font-bold">{item.qty}</TableCell>
                              <TableCell className="text-xs text-center">{item.quoteCount}</TableCell>
                              <TableCell className="text-xs text-right">
                                {formatCurrency(item.value, item.currency as any)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Profit Margin Analytics */}
          {profitData.quotesWithCost > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Profit Margin Analytics
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {profitData.quotesWithCost} quotes with cost data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* KPI Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase">Total Revenue</p>
                    <p className="text-sm font-bold">{formatCurrency(profitData.totalRevenue, stats.dominantCurrency as any)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase">Total Cost</p>
                    <p className="text-sm font-bold">{formatCurrency(profitData.totalCost, stats.dominantCurrency as any)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase">Total Profit</p>
                    <p className={`text-sm font-bold ${profitData.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {formatCurrency(profitData.totalProfit, stats.dominantCurrency as any)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase">Overall Margin</p>
                    <p className={`text-sm font-bold ${profitData.overallMargin >= 30 ? 'text-emerald-500' : profitData.overallMargin >= 15 ? 'text-amber-500' : 'text-destructive'}`}>
                      {profitData.overallMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="trend" className="w-full">
                  <TabsList className="mb-3">
                    <TabsTrigger value="trend" className="text-xs gap-1">
                      <TrendingUp className="w-3 h-3" /> Monthly Trend
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="text-xs gap-1">
                      <Users className="w-3 h-3" /> Per Customer
                    </TabsTrigger>
                    <TabsTrigger value="quotes" className="text-xs gap-1">
                      <FileText className="w-3 h-3" /> Per Quote
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="trend">
                    {monthlyProfitData.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Profit bar chart */}
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={monthlyProfitData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: 12,
                                color: 'hsl(var(--foreground))',
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => [formatCurrency(value, stats.dominantCurrency as any), '']}
                            />
                            <Bar dataKey="revenue" fill="hsl(210, 80%, 55%)" name="Revenue" />
                            <Bar dataKey="cost" fill="hsl(0, 70%, 55%)" name="Cost" />
                            <Bar dataKey="profit" fill="hsl(152, 60%, 45%)" name="Profit" radius={[4, 4, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </BarChart>
                        </ResponsiveContainer>

                        {/* Margin % line chart */}
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={monthlyProfitData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: 12,
                                color: 'hsl(var(--foreground))',
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']}
                            />
                            <Line type="monotone" dataKey="margin" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Margin %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">No monthly data available</p>
                    )}
                  </TabsContent>

                  <TabsContent value="customers">
                    {profitData.perCustomer.length > 0 ? (
                      <div className="space-y-4">
                        {/* Customer profit bar chart */}
                        <ResponsiveContainer width="100%" height={Math.max(200, profitData.perCustomer.length * 40)}>
                          <BarChart data={profitData.perCustomer.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis dataKey="clientName" type="category" width={120} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: 12,
                                color: 'hsl(var(--foreground))',
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => [formatCurrency(value, stats.dominantCurrency as any), '']}
                            />
                            <Bar dataKey="revenue" fill="hsl(210, 80%, 55%)" name="Revenue" />
                            <Bar dataKey="cost" fill="hsl(0, 70%, 55%)" name="Cost" />
                            <Bar dataKey="profit" fill="hsl(152, 60%, 45%)" name="Profit" radius={[0, 4, 4, 0]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </BarChart>
                        </ResponsiveContainer>

                        {/* Customer table */}
                        <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Customer</TableHead>
                                <TableHead className="text-xs text-center">Quotes</TableHead>
                                <TableHead className="text-xs text-right">Revenue</TableHead>
                                <TableHead className="text-xs text-right">Cost</TableHead>
                                <TableHead className="text-xs text-right">Profit</TableHead>
                                <TableHead className="text-xs text-right">Margin</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {profitData.perCustomer.map(c => (
                                <TableRow key={c.clientName}>
                                  <TableCell className="text-xs font-medium truncate max-w-[180px]">{c.clientName}</TableCell>
                                  <TableCell className="text-xs text-center">{c.quoteCount}</TableCell>
                                  <TableCell className="text-xs text-right">{formatCurrency(c.revenue, stats.dominantCurrency as any)}</TableCell>
                                  <TableCell className="text-xs text-right">{formatCurrency(c.cost, stats.dominantCurrency as any)}</TableCell>
                                  <TableCell className={`text-xs text-right font-medium ${c.profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                    {formatCurrency(c.profit, stats.dominantCurrency as any)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right">
                                    <span className={`font-bold ${c.margin >= 30 ? 'text-emerald-500' : c.margin >= 15 ? 'text-amber-500' : 'text-destructive'}`}>
                                      {c.margin.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">No customer data available</p>
                    )}
                  </TabsContent>

                  <TabsContent value="quotes">
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Quote #</TableHead>
                            <TableHead className="text-xs">Client</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                            <TableHead className="text-xs text-right">Revenue</TableHead>
                            <TableHead className="text-xs text-right">Cost</TableHead>
                            <TableHead className="text-xs text-right">Profit</TableHead>
                            <TableHead className="text-xs text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profitData.perQuote
                            .sort((a, b) => b.margin - a.margin)
                            .map(q => (
                              <TableRow key={q.quoteNumber}>
                                <TableCell className="text-xs font-mono font-medium">{q.quoteNumber}</TableCell>
                                <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{q.clientName}</TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(q.revenue, stats.dominantCurrency as any)}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(q.cost, stats.dominantCurrency as any)}</TableCell>
                                <TableCell className={`text-xs text-right font-medium ${q.profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                  {formatCurrency(q.profit, stats.dominantCurrency as any)}
                                </TableCell>
                                <TableCell className="text-xs text-right">
                                  <span className={`font-bold ${q.margin >= 30 ? 'text-emerald-500' : q.margin >= 15 ? 'text-amber-500' : 'text-destructive'}`}>
                                    {q.margin.toFixed(1)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};