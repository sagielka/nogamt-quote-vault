import { useMemo } from 'react';
import { Quotation } from '@/types/quotation';
import { calculateTotal, formatCurrency } from '@/lib/quotation-utils';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, DollarSign, Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';

interface QuotationStatsProps {
  quotations: Quotation[];
}

export const QuotationStats = ({ quotations }: QuotationStatsProps) => {
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

    // Determine dominant currency for display
    const currencyCounts: Record<string, number> = {};
    quotations.forEach(q => {
      currencyCounts[q.currency] = (currencyCounts[q.currency] || 0) + 1;
    });
    const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    return { total, byStatus, totalValue, acceptedValue, conversionRate, expiringSoon, dominantCurrency };
  }, [quotations]);

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
      isString: true,
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
      isString: true,
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
  );
};
