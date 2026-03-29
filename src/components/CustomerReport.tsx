import { useState, useMemo } from 'react';
import { Quotation, Currency } from '@/types/quotation';
import { calculateTotal, calculateSubtotal, formatCurrency, formatDate, getStatusColor } from '@/lib/quotation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, FileText, DollarSign, TrendingUp, CheckCircle, Clock, Ban,
  Download, Mail, MapPin, Package, Calendar, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

interface CustomerReportProps {
  customerName: string;
  customerEmail: string;
  customerAddress?: string | null;
  quotations: Quotation[];
  onBack: () => void;
  onViewQuotation?: (id: string) => void;
}

const STATUS_COLORS_CHART: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  sent: 'hsl(210, 80%, 55%)',
  accepted: 'hsl(152, 60%, 45%)',
  declined: 'hsl(0, 70%, 55%)',
  finished: 'hsl(35, 90%, 55%)',
};

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export const CustomerReport = ({
  customerName,
  customerEmail,
  customerAddress,
  quotations,
  onBack,
  onViewQuotation,
}: CustomerReportProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  // Filter quotations for this customer
  const customerQuotations = useMemo(() => {
    const emails = customerEmail.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return quotations.filter(q => {
      const qEmails = q.clientEmail.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      return qEmails.some(e => emails.includes(e)) || q.clientName.toLowerCase() === customerName.toLowerCase();
    });
  }, [quotations, customerEmail, customerName]);

  // Stats
  const stats = useMemo(() => {
    const total = customerQuotations.length;
    const accepted = customerQuotations.filter(q => q.status === 'accepted').length;
    const finished = customerQuotations.filter(q => q.status === 'finished').length;
    const sent = customerQuotations.filter(q => q.status === 'sent').length;
    const draft = customerQuotations.filter(q => q.status === 'draft').length;

    const totalValue = customerQuotations.reduce((sum, q) => {
      return sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
    }, 0);

    const acceptedValue = customerQuotations
      .filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue), 0);

    const conversionRate = total > 0 ? (accepted / total) * 100 : 0;

    // Most used currency
    const currencyCounts: Record<string, number> = {};
    customerQuotations.forEach(q => {
      currencyCounts[q.currency] = (currencyCounts[q.currency] || 0) + 1;
    });
    const primaryCurrency = (Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD') as Currency;

    // Average quote value
    const avgValue = total > 0 ? totalValue / total : 0;

    return { total, accepted, finished, sent, draft, totalValue, acceptedValue, conversionRate, primaryCurrency, avgValue };
  }, [customerQuotations]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    customerQuotations.forEach(q => {
      const s = q.status || 'draft';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [customerQuotations]);

  // Monthly trend
  const monthlyData = useMemo(() => {
    const months: Record<string, { count: number; value: number }> = {};
    customerQuotations.forEach(q => {
      const d = new Date(q.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { count: 0, value: 0 };
      months[key].count++;
      months[key].value += calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month: month.slice(2), // YY-MM
        quotes: data.count,
        value: Math.round(data.value),
      }));
  }, [customerQuotations]);

  // Top products
  const topProducts = useMemo(() => {
    const products: Record<string, { sku: string; description: string; totalQty: number; totalValue: number; count: number }> = {};
    customerQuotations.forEach(q => {
      q.items.forEach(item => {
        const key = item.sku || item.description;
        if (!products[key]) {
          products[key] = { sku: item.sku, description: item.description, totalQty: 0, totalValue: 0, count: 0 };
        }
        products[key].totalQty += item.moq;
        products[key].totalValue += item.moq * item.unitPrice;
        products[key].count++;
      });
    });
    return Object.values(products)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [customerQuotations]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Title
      doc.setFontSize(18);
      doc.text('Customer Report', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Customer info
      doc.setFontSize(12);
      doc.text(`Customer: ${customerName}`, 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Email: ${customerEmail}`, 14, y);
      y += 6;
      if (customerAddress) {
        doc.text(`Address: ${customerAddress}`, 14, y);
        y += 6;
      }
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, y);
      y += 10;

      // Stats summary
      doc.setFontSize(12);
      doc.text('Summary', 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Total Quotations: ${stats.total}`, 14, y); y += 6;
      doc.text(`Accepted: ${stats.accepted}`, 14, y); y += 6;
      doc.text(`Conversion Rate: ${stats.conversionRate.toFixed(1)}%`, 14, y); y += 6;
      doc.text(`Total Value: ${formatCurrency(stats.totalValue, stats.primaryCurrency)}`, 14, y); y += 6;
      doc.text(`Accepted Value: ${formatCurrency(stats.acceptedValue, stats.primaryCurrency)}`, 14, y); y += 10;

      // Quotation table
      doc.setFontSize(12);
      doc.text('Quotation History', 14, y);
      y += 7;

      // Table header
      doc.setFontSize(8);
      doc.setFont(undefined!, 'bold');
      const cols = [14, 55, 85, 115, 150];
      doc.text('Quote #', cols[0], y);
      doc.text('Date', cols[1], y);
      doc.text('Status', cols[2], y);
      doc.text('Items', cols[3], y);
      doc.text('Total', cols[4], y);
      y += 5;
      doc.line(14, y, pageWidth - 14, y);
      y += 4;

      doc.setFont(undefined!, 'normal');
      customerQuotations
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .forEach(q => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const total = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
          doc.text(q.quoteNumber, cols[0], y);
          doc.text(new Date(q.createdAt).toLocaleDateString(), cols[1], y);
          doc.text((q.status || 'draft').toUpperCase(), cols[2], y);
          doc.text(String(q.items.length), cols[3], y);
          doc.text(formatCurrency(total, q.currency), cols[4], y);
          y += 5;
        });

      // Top products
      if (topProducts.length > 0) {
        y += 8;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text('Top Products', 14, y);
        y += 7;
        doc.setFontSize(8);
        doc.setFont(undefined!, 'bold');
        doc.text('SKU', 14, y);
        doc.text('Description', 50, y);
        doc.text('Total Qty', 130, y);
        doc.text('Total Value', 160, y);
        y += 5;
        doc.line(14, y, pageWidth - 14, y);
        y += 4;
        doc.setFont(undefined!, 'normal');
        topProducts.forEach(p => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(p.sku || '-', 14, y);
          doc.text(p.description.slice(0, 40), 50, y);
          doc.text(String(p.totalQty), 130, y);
          doc.text(formatCurrency(p.totalValue, stats.primaryCurrency), 160, y);
          y += 5;
        });
      }

      doc.save(`Customer-Report-${customerName.replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'Report Exported', description: 'PDF report has been downloaded.' });
    } catch {
      toast({ title: 'Export Failed', description: 'Failed to generate PDF report.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{customerName}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {customerEmail}
              </span>
              {customerAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {customerAddress}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={handleExportPDF} disabled={exporting} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="w-3 h-3" />
              Total Quotes
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CheckCircle className="w-3 h-3" />
              Accepted
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Conversion
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Total Value
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalValue, stats.primaryCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Won Value
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.acceptedValue, stats.primaryCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="w-3 h-3" />
              Avg Value
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(stats.avgValue, stats.primaryCurrency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {customerQuotations.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          {monthlyData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Quotation Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number, name: string) => [value, name === 'quotes' ? 'Quotes' : 'Value']}
                    />
                    <Bar dataKey="quotes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Status Distribution */}
          {statusData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Times Quoted</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{p.description}</TableCell>
                    <TableCell className="text-right">{p.count}</TableCell>
                    <TableCell className="text-right">{p.totalQty}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(p.totalValue, stats.primaryCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quotation History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Quotation History ({customerQuotations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerQuotations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No quotations found for this customer.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerQuotations
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(q => {
                    const total = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
                    const isExpired = new Date(q.validUntil) < new Date() && q.status !== 'accepted';
                    return (
                      <TableRow
                        key={q.id}
                        className={onViewQuotation ? 'cursor-pointer hover:bg-accent/50' : ''}
                        onClick={() => onViewQuotation?.(q.id)}
                      >
                        <TableCell className="font-mono text-xs font-medium">{q.quoteNumber}</TableCell>
                        <TableCell className="text-sm">{formatDate(new Date(q.createdAt))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(q.status)}`}>
                            {(q.status || 'draft').toUpperCase()}
                          </Badge>
                          {isExpired && (
                            <Badge variant="destructive" className="text-[10px] ml-1">EXPIRED</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(new Date(q.validUntil))}</TableCell>
                        <TableCell className="text-right">{q.items.length}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(total, q.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
