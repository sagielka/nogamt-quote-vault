import { useMemo, useState } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, isWithinInterval } from 'date-fns';
import { Quotation } from '@/types/quotation';
import { calculateTotal, calculateLineTotal, formatCurrency } from '@/lib/quotation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, DollarSign, Clock, CheckCircle, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Users, Package, Layers, CalendarIcon, X, Download } from 'lucide-react';
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

    const totalValue = filteredQuotations.reduce((sum, q) => {
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      return sum + val;
    }, 0);

    const acceptedValue = filteredQuotations
      .filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue), 0);

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

    return { total, byStatus, totalValue, acceptedValue, conversionRate, expiringSoon, dominantCurrency };
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

  // Product family breakdown
  const familyStats = useMemo(() => {
    const families: Record<string, { qty: number; value: number; quotations: Set<string> }> = {};

    filteredQuotations.forEach(q => {
      q.items.forEach(item => {
        const family = getFamily(item.sku, item.description);
        if (!families[family]) {
          families[family] = { qty: 0, value: 0, quotations: new Set() };
        }
        families[family].qty += item.moq;
        families[family].value += calculateLineTotal(item);
        families[family].quotations.add(q.id);
      });
    });

    return Object.entries(families)
      .map(([family, data]) => ({
        family,
        qty: data.qty,
        value: data.value,
        quoteCount: data.quotations.size,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredQuotations]);

  // Family pie chart data
  const familyPieData = useMemo(() => {
    const colors = [
      'hsl(210, 80%, 55%)', 'hsl(152, 60%, 45%)', 'hsl(35, 90%, 55%)',
      'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(180, 60%, 45%)',
      'hsl(60, 70%, 45%)', 'hsl(320, 60%, 55%)',
    ];
    return familyStats.map((f, i) => ({
      name: f.family,
      value: f.qty,
      color: colors[i % colors.length],
    }));
  }, [familyStats]);

  // Top items by quantity
  const topItems = useMemo(() => {
    const items: Record<string, { sku: string; description: string; qty: number; value: number; quoteCount: Set<string> }> = {};

    filteredQuotations.forEach(q => {
      q.items.forEach(item => {
        const key = item.sku.trim().toUpperCase();
        if (!key) return;
        if (!items[key]) {
          items[key] = { sku: item.sku, description: item.description, qty: 0, value: 0, quoteCount: new Set() };
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

  const exportCSV = () => {
    const rows: string[][] = [];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    // Summary
    rows.push(['=== SUMMARY ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Quotes', String(stats.total)]);
    rows.push(['Total Value', String(stats.totalValue.toFixed(2))]);
    rows.push(['Orders Received', String(stats.byStatus.accepted)]);
    rows.push(['Accepted Value', String(stats.acceptedValue.toFixed(2))]);
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
      rows.push(['Family', 'Quantity', 'Quotes', 'Value']);
      familyStats.forEach(f => {
        rows.push([f.family, String(f.qty), String(f.quoteCount), f.value.toFixed(2)]);
      });
      rows.push([]);
    }

    // Top items
    if (topItems.length > 0) {
      rows.push(['=== TOP ITEMS ===']);
      rows.push(['SKU', 'Description', 'Family', 'Quantity', 'In Quotes', 'Value']);
      topItems.forEach(item => {
        rows.push([item.sku, item.description, getFamily(item.sku, item.description), String(item.qty), String(item.quoteCount), item.value.toFixed(2)]);
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
      value: formatCurrency(stats.totalValue, stats.dominantCurrency as any),
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Orders Received',
      value: stats.byStatus.accepted,
      subtitle: formatCurrency(stats.acceptedValue, stats.dominantCurrency as any),
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
                              <TableHead className="text-xs text-center">Qty</TableHead>
                              <TableHead className="text-xs text-center">Quotes</TableHead>
                              <TableHead className="text-xs text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {familyStats.map(f => (
                              <TableRow key={f.family}>
                                <TableCell className="text-xs font-medium">
                                  <Badge variant="outline" className="text-[10px]">{f.family}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center font-bold">{f.qty}</TableCell>
                                <TableCell className="text-xs text-center">{f.quoteCount}</TableCell>
                                <TableCell className="text-xs text-right">
                                  {formatCurrency(f.value, stats.dominantCurrency as any)}
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
                            <TableHead className="text-xs text-center">Total Qty</TableHead>
                            <TableHead className="text-xs text-center">In Quotes</TableHead>
                            <TableHead className="text-xs text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topItems.map((item, i) => (
                            <TableRow key={item.sku}>
                              <TableCell className="text-xs font-mono font-medium">{item.sku}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</TableCell>
                              <TableCell className="text-xs text-center">
                                <Badge variant="outline" className="text-[10px]">{getFamily(item.sku, item.description)}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-center font-bold">{item.qty}</TableCell>
                              <TableCell className="text-xs text-center">{item.quoteCount}</TableCell>
                              <TableCell className="text-xs text-right">
                                {formatCurrency(item.value, stats.dominantCurrency as any)}
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
