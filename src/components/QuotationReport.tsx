import { useState, useMemo, useRef } from 'react';
import { Quotation, Currency, CURRENCIES } from '@/types/quotation';
import { calculateTotal, calculateSubtotal, calculateLineTotal, formatCurrency, formatDate } from '@/lib/quotation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, FileText, DollarSign, TrendingUp, Package, Users, BarChart3,
  Download, Search, X, PieChart as PieChartIcon, Calendar, Hash
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

interface QuotationReportProps {
  quotations: Quotation[];
  onBack: () => void;
  onViewQuotation?: (id: string) => void;
  userNameMap?: Record<string, string>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  sent: 'hsl(210, 80%, 55%)',
  accepted: 'hsl(152, 60%, 45%)',
  declined: 'hsl(0, 70%, 55%)',
  finished: 'hsl(35, 90%, 55%)',
};

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-popover-foreground text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
      ))}
    </div>
  );
};

export const QuotationReport = ({ quotations, onBack, onViewQuotation, userNameMap }: QuotationReportProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const chartsRef = useRef<HTMLDivElement>(null);

  // === KPI CALCULATIONS ===
  const kpis = useMemo(() => {
    const total = quotations.length;
    const accepted = quotations.filter(q => q.status === 'accepted').length;
    const totalValue = quotations.reduce((sum, q) => sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue), 0);
    const acceptedValue = quotations.filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue), 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    const conversionRate = total > 0 ? (accepted / total) * 100 : 0;
    const totalItems = quotations.reduce((sum, q) => sum + q.items.length, 0);
    return { total, accepted, totalValue, acceptedValue, avgValue, conversionRate, totalItems };
  }, [quotations]);

  // === BY CUSTOMER ===
  const customerData = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalValue: number; acceptedCount: number; acceptedValue: number }> = {};
    quotations.forEach(q => {
      const key = q.clientName.toLowerCase();
      if (!map[key]) {
        map[key] = { name: q.clientName, count: 0, totalValue: 0, acceptedCount: 0, acceptedValue: 0 };
      }
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      map[key].count++;
      map[key].totalValue += val;
      if (q.status === 'accepted') {
        map[key].acceptedCount++;
        map[key].acceptedValue += val;
      }
    });
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [quotations]);

  const filteredCustomerData = useMemo(() => {
    if (!customerSearch) return customerData;
    const q = customerSearch.toLowerCase();
    return customerData.filter(c => c.name.toLowerCase().includes(q));
  }, [customerData, customerSearch]);

  // === BY SKU ===
  const skuData = useMemo(() => {
    const map: Record<string, { sku: string; description: string; totalQty: number; totalRevenue: number; quoteCount: number; avgPrice: number }> = {};
    quotations.forEach(q => {
      q.items.forEach(item => {
        const key = item.sku || item.description;
        if (!map[key]) {
          map[key] = { sku: item.sku, description: item.description, totalQty: 0, totalRevenue: 0, quoteCount: 0, avgPrice: 0 };
        }
        map[key].totalQty += item.moq;
        map[key].totalRevenue += calculateLineTotal(item);
        map[key].quoteCount++;
      });
    });
    Object.values(map).forEach(s => { s.avgPrice = s.totalQty > 0 ? s.totalRevenue / s.totalQty : 0; });
    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [quotations]);

  const filteredSkuData = useMemo(() => {
    if (!skuSearch) return skuData;
    const q = skuSearch.toLowerCase();
    return skuData.filter(s => s.sku.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [skuData, skuSearch]);

  // === BY STATUS ===
  const statusData = useMemo(() => {
    const map: Record<string, { status: string; count: number; value: number }> = {};
    quotations.forEach(q => {
      const s = q.status || 'draft';
      if (!map[s]) map[s] = { status: s, count: 0, value: 0 };
      map[s].count++;
      map[s].value += calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
    });
    return Object.values(map);
  }, [quotations]);

  // === BY MONTH ===
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; count: number; value: number; accepted: number }> = {};
    quotations.forEach(q => {
      const d = new Date(q.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!map[key]) map[key] = { month: label, count: 0, value: 0, accepted: 0 };
      map[key].count++;
      map[key].value += calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      if (q.status === 'accepted') map[key].accepted++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [quotations]);

  // === ALL LINE ITEMS ===
  const allLineItems = useMemo(() => {
    const items: { quoteNumber: string; clientName: string; status: string; sku: string; description: string; qty: number; unitPrice: number; lineTotal: number; currency: Currency; createdAt: Date; quotationId: string }[] = [];
    quotations.forEach(q => {
      q.items.forEach(item => {
        items.push({
          quoteNumber: q.quoteNumber,
          clientName: q.clientName,
          status: q.status,
          sku: item.sku,
          description: item.description,
          qty: item.moq,
          unitPrice: item.unitPrice,
          lineTotal: calculateLineTotal(item),
          currency: q.currency,
          createdAt: q.createdAt,
          quotationId: q.id,
        });
      });
    });
    return items;
  }, [quotations]);

  // === EXPORT PDF ===
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.text('Quotation Report', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // KPIs
      doc.setFontSize(14);
      doc.text('Summary', 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Total Quotations: ${kpis.total}`, 14, y); y += 6;
      doc.text(`Accepted: ${kpis.accepted} (${kpis.conversionRate.toFixed(1)}%)`, 14, y); y += 6;
      doc.text(`Total Value: $${kpis.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y); y += 6;
      doc.text(`Won Value: $${kpis.acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y); y += 6;
      doc.text(`Average Value: $${kpis.avgValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y); y += 6;
      doc.text(`Total Line Items: ${kpis.totalItems}`, 14, y); y += 12;

      // Top customers
      doc.setFontSize(14);
      doc.text('Top Customers by Value', 14, y); y += 8;
      doc.setFontSize(9);
      const topCustomers = customerData.slice(0, 15);
      topCustomers.forEach(c => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${c.name}: ${c.count} quotes, $${c.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y);
        y += 5;
      });
      y += 8;

      // Top SKUs
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text('Top Products by Revenue', 14, y); y += 8;
      doc.setFontSize(9);
      const topSkus = skuData.slice(0, 15);
      topSkus.forEach(s => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${s.sku || s.description}: qty ${s.totalQty}, $${s.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y);
        y += 5;
      });

      // Status breakdown
      if (y > 240) { doc.addPage(); y = 20; }
      y += 8;
      doc.setFontSize(14);
      doc.text('Status Breakdown', 14, y); y += 8;
      doc.setFontSize(9);
      statusData.forEach(s => {
        doc.text(`${s.status}: ${s.count} quotes, $${s.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, y);
        y += 5;
      });

      doc.save('quotation-report.pdf');
      toast({ title: 'PDF Exported', description: 'Report downloaded successfully.' });
    } catch (err) {
      toast({ title: 'Export Failed', description: 'Could not generate PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // === EXPORT CSV ===
  const handleExportCSV = () => {
    // Line items CSV
    const headers = ['Quote #', 'Customer', 'Status', 'SKU', 'Description', 'Qty', 'Unit Price', 'Line Total', 'Currency', 'Date'];
    const rows = allLineItems.map(i => [
      i.quoteNumber, i.clientName, i.status, i.sku, i.description,
      i.qty, i.unitPrice.toFixed(2), i.lineTotal.toFixed(2), i.currency,
      new Date(i.createdAt).toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quotation-line-items.csv'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Exported', description: 'Line items exported successfully.' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h2 className="heading-display text-2xl text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6" /> Quotation Reports
            </h2>
            <p className="text-sm text-muted-foreground">{quotations.length} quotations analyzed</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Total Quotes</p>
          <p className="text-2xl font-bold text-foreground">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="text-2xl font-bold text-success">{kpis.accepted}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Conversion</p>
          <p className="text-2xl font-bold text-primary">{kpis.conversionRate.toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-xl font-bold text-foreground">${kpis.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Won Value</p>
          <p className="text-xl font-bold text-success">${kpis.acceptedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Line Items</p>
          <p className="text-2xl font-bold text-foreground">{kpis.totalItems}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">By Customer</TabsTrigger>
          <TabsTrigger value="products">By Product/SKU</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="items">All Line Items</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Status pie */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, count }) => `${status} (${count})`}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Status value bar */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Value by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Value ($)" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          {/* Top 10 customers */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Top 10 Customers by Value</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalValue" name="Total Value ($)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {/* Top 10 SKUs */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Top 10 Products by Revenue</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={skuData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="sku" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalRevenue" name="Revenue ($)" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="pl-9 pr-9" />
            {customerSearch && <button onClick={() => setCustomerSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Quotes</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead className="text-right">Won Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomerData.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{c.acceptedCount}</TableCell>
                        <TableCell className="text-right">{c.count > 0 ? ((c.acceptedCount / c.count) * 100).toFixed(0) : 0}%</TableCell>
                        <TableCell className="text-right">${c.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${c.acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search SKU or description..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} className="pl-9 pr-9" />
            {skuSearch && <button onClick={() => setSkuSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quotes</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSkuData.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{s.sku || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.description}</TableCell>
                        <TableCell className="text-right">{s.quoteCount}</TableCell>
                        <TableCell className="text-right">{s.totalQty.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${s.avgPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${s.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> Monthly Quote Count</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="accepted" name="Accepted" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Monthly Value Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" name="Value ($)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Line Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <p className="text-sm text-muted-foreground">{allLineItems.length} line items across {quotations.length} quotations</p>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLineItems.slice(0, 200).map((item, i) => (
                      <TableRow
                        key={i}
                        className={onViewQuotation ? 'cursor-pointer hover:bg-accent/50' : ''}
                        onClick={() => onViewQuotation?.(item.quotationId)}
                      >
                        <TableCell className="font-mono text-xs">{item.quoteNumber}</TableCell>
                        <TableCell>{item.clientName}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs capitalize">{item.status}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{item.sku || '—'}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{item.description}</TableCell>
                        <TableCell className="text-right">{item.qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${item.lineTotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {allLineItems.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Showing first 200 of {allLineItems.length} items. Export CSV for full data.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
