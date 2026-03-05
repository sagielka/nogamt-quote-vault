import { useMemo, useState } from 'react';
import { Quotation } from '@/types/quotation';
import { calculateTotal, formatCurrency } from '@/lib/quotation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, Clock, CheckCircle, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';

interface QuotationStatsProps {
  quotations: Quotation[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  sent: 'hsl(210, 80%, 55%)',
  accepted: 'hsl(152, 60%, 45%)',
  declined: 'hsl(0, 70%, 55%)',
};

export const QuotationStats = ({ quotations }: QuotationStatsProps) => {
  const [chartsOpen, setChartsOpen] = useState(false);

  const stats = useMemo(() => {
    const total = quotations.length;
    const byStatus = {
      draft: quotations.filter(q => q.status === 'draft').length,
      sent: quotations.filter(q => q.status === 'sent').length,
      accepted: quotations.filter(q => q.status === 'accepted').length,
      declined: quotations.filter(q => q.status === 'declined').length,
    };

    const totalValue = quotations.reduce((sum, q) => {
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      return sum + val;
    }, 0);

    const acceptedValue = quotations
      .filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue), 0);

    const conversionRate = total > 0 ? ((byStatus.accepted / total) * 100) : 0;

    const now = new Date();
    const expiringSoon = quotations.filter(q => {
      if (q.status === 'accepted' || q.status === 'declined') return false;
      const validUntil = new Date(q.validUntil);
      const daysLeft = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 7;
    }).length;

    const currencyCounts: Record<string, number> = {};
    quotations.forEach(q => {
      currencyCounts[q.currency] = (currencyCounts[q.currency] || 0) + 1;
    });
    const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    return { total, byStatus, totalValue, acceptedValue, conversionRate, expiringSoon, dominantCurrency };
  }, [quotations]);

  // Monthly trend data
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; draft: number; sent: number; accepted: number; declined: number; total: number }> = {};
    
    quotations.forEach(q => {
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
  }, [quotations]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    return [
      { name: 'Draft', value: stats.byStatus.draft, color: STATUS_COLORS.draft },
      { name: 'Sent', value: stats.byStatus.sent, color: STATUS_COLORS.sent },
      { name: 'Accepted', value: stats.byStatus.accepted, color: STATUS_COLORS.accepted },
      { name: 'Declined', value: stats.byStatus.declined, color: STATUS_COLORS.declined },
    ].filter(d => d.value > 0);
  }, [stats.byStatus]);

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="overflow-hidden">
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
        ))}
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
                      }}
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
                      }}
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
      )}
    </div>
  );
};
