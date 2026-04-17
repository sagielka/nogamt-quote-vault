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

  // === KPI CALCULATIONS (grouped by currency) ===
  const kpis = useMemo(() => {
    const total = quotations.length;
    const accepted = quotations.filter(q => q.status === 'accepted').length;
    const conversionRate = total > 0 ? (accepted / total) * 100 : 0;
    const totalItems = quotations.reduce((sum, q) => sum + q.items.length, 0);

    const byCurrency: Record<string, { currency: Currency; total: number; accepted: number; count: number }> = {};
    quotations.forEach(q => {
      const cur = (q.currency || 'USD') as Currency;
      if (!byCurrency[cur]) byCurrency[cur] = { currency: cur, total: 0, accepted: 0, count: 0 };
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      byCurrency[cur].total += val;
      byCurrency[cur].count++;
      if (q.status === 'accepted') byCurrency[cur].accepted += val;
    });
    const currencyTotals = Object.values(byCurrency).sort((a, b) => b.total - a.total);
    return { total, accepted, conversionRate, totalItems, currencyTotals };
  }, [quotations]);

  // === BY CUSTOMER (per currency) ===
  type CustomerRow = { name: string; currency: Currency; count: number; totalValue: number; acceptedCount: number; acceptedValue: number };
  const customerData = useMemo(() => {
    const map: Record<string, CustomerRow> = {};
    quotations.forEach(q => {
      const cur = (q.currency || 'USD') as Currency;
      const key = `${q.clientName.toLowerCase()}__${cur}`;
      if (!map[key]) {
        map[key] = { name: q.clientName, currency: cur, count: 0, totalValue: 0, acceptedCount: 0, acceptedValue: 0 };
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

  // === BY SKU (per currency) ===
  type SkuRow = { sku: string; description: string; currency: Currency; totalQty: number; totalRevenue: number; quoteCount: number; avgPrice: number };
  const skuData = useMemo(() => {
    const map: Record<string, SkuRow> = {};
    quotations.forEach(q => {
      const cur = (q.currency || 'USD') as Currency;
      q.items.forEach(item => {
        const key = `${item.sku || item.description}__${cur}`;
        if (!map[key]) {
          map[key] = { sku: item.sku, description: item.description, currency: cur, totalQty: 0, totalRevenue: 0, quoteCount: 0, avgPrice: 0 };
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

  // === BY STATUS (count only — values mix currencies) ===
  const statusData = useMemo(() => {
    const map: Record<string, { status: string; count: number }> = {};
    quotations.forEach(q => {
      const s = q.status || 'draft';
      if (!map[s]) map[s] = { status: s, count: 0 };
      map[s].count++;
    });
    return Object.values(map);
  }, [quotations]);

  // === STATUS VALUE BY CURRENCY (for bar chart) ===
  const statusValueByCurrency = useMemo(() => {
    const map: Record<string, any> = {};
    const currencies = new Set<string>();
    quotations.forEach(q => {
      const s = q.status || 'draft';
      const cur = (q.currency || 'USD');
      currencies.add(cur);
      if (!map[s]) map[s] = { status: s };
      const val = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
      map[s][cur] = (map[s][cur] || 0) + val;
    });
    return { rows: Object.values(map), currencies: Array.from(currencies) };
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

  // === Helper: load font as base64 ===
  const loadFontAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // === Helper: detect Hebrew ===
  const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

  // === Helper: process text for RTL in jsPDF ===
  const processText = (text: string): string => {
    if (!containsHebrew(text)) return text;
    const regex = /([\u0590-\u05FF\u0027\u0022]+(?:\s+[\u0590-\u05FF\u0027\u0022]+)*)|([^\u0590-\u05FF]+)/g;
    const runs: { text: string; isHebrew: boolean }[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) runs.push({ text: match[1], isHebrew: true });
      else if (match[2]) runs.push({ text: match[2], isHebrew: false });
    }
    if (runs.length === 1 && runs[0].isHebrew) return text.split('').reverse().join('');
    const processed = runs.map(r => r.isHebrew ? r.text.split('').reverse().join('') : r.text);
    processed.reverse();
    return processed.join('');
  };

  // === EXPORT PDF ===
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Register Heebo font for Hebrew support
      try {
        const heeboBase64 = await loadFontAsBase64('/fonts/Heebo-Variable.ttf');
        doc.addFileToVFS('Heebo-Regular.ttf', heeboBase64);
        doc.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
        doc.addFileToVFS('Heebo-Bold.ttf', heeboBase64);
        doc.addFont('Heebo-Bold.ttf', 'Heebo', 'bold');
        doc.setFont('Heebo', 'normal');
      } catch (e) {
        console.warn('Could not load Heebo font, falling back to helvetica:', e);
      }

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
      doc.text(`Total Line Items: ${kpis.totalItems}`, 14, y); y += 8;
      doc.text('Totals by currency:', 14, y); y += 6;
      kpis.currencyTotals.forEach(c => {
        const avg = c.count > 0 ? c.total / c.count : 0;
        doc.text(`  ${c.currency}: ${c.count} quotes — total ${formatCurrency(c.total, c.currency)}, won ${formatCurrency(c.accepted, c.currency)}, avg ${formatCurrency(avg, c.currency)}`, 14, y);
        y += 6;
      });
      y += 6;

      // === Capture charts from the dashboard ===
      if (chartsRef.current) {
        try {
          const canvas = await html2canvas(chartsRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - 28; // 14mm margins on each side
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Add charts on new page(s)
          doc.addPage();
          y = 15;
          doc.setFontSize(14);
          doc.text('Dashboard Charts', 14, y); y += 8;

          const pageHeight = doc.internal.pageSize.getHeight();
          const maxImgPerPage = pageHeight - 25;

          if (imgHeight <= maxImgPerPage) {
            doc.addImage(imgData, 'PNG', 14, y, imgWidth, imgHeight);
          } else {
            // Multi-page chart rendering
            let remainingHeight = imgHeight;
            let srcY = 0;
            const srcWidth = canvas.width;
            const srcTotalHeight = canvas.height;
            let isFirstChunk = true;

            while (remainingHeight > 0) {
              if (!isFirstChunk) {
                doc.addPage();
                y = 15;
              }
              const chunkDisplayHeight = Math.min(remainingHeight, maxImgPerPage);
              const chunkSrcHeight = (chunkDisplayHeight / imgHeight) * srcTotalHeight;

              // Create a cropped canvas for this chunk
              const chunkCanvas = document.createElement('canvas');
              chunkCanvas.width = srcWidth;
              chunkCanvas.height = chunkSrcHeight;
              const ctx = chunkCanvas.getContext('2d')!;
              ctx.drawImage(canvas, 0, srcY, srcWidth, chunkSrcHeight, 0, 0, srcWidth, chunkSrcHeight);
              const chunkImg = chunkCanvas.toDataURL('image/png');

              doc.addImage(chunkImg, 'PNG', 14, y, imgWidth, chunkDisplayHeight);

              srcY += chunkSrcHeight;
              remainingHeight -= chunkDisplayHeight;
              isFirstChunk = false;
            }
          }
        } catch (chartErr) {
          console.warn('Could not capture charts:', chartErr);
        }
      }

      // Top customers (text) - new page
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.text('Top Customers by Value', 14, y); y += 8;
      doc.setFontSize(9);
      const topCustomers = customerData.slice(0, 15);
      topCustomers.forEach(c => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(processText(`${c.name} [${c.currency}]: ${c.count} quotes, ${formatCurrency(c.totalValue, c.currency)}`), 14, y);
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
        doc.text(processText(`${s.sku || s.description} [${s.currency}]: qty ${s.totalQty}, ${formatCurrency(s.totalRevenue, s.currency)}`), 14, y);
        y += 5;
      });

      // Status breakdown (counts only — values vary by currency)
      if (y > 240) { doc.addPage(); y = 20; }
      y += 8;
      doc.setFontSize(14);
      doc.text('Status Breakdown', 14, y); y += 8;
      doc.setFontSize(9);
      statusData.forEach(s => {
        doc.text(`${s.status}: ${s.count} quotes`, 14, y);
        y += 5;
      });

      doc.save('quotation-report.pdf');
      toast({ title: 'PDF Exported', description: 'Report with charts downloaded successfully.' });
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <p className="text-xs text-muted-foreground">Line Items</p>
          <p className="text-2xl font-bold text-foreground">{kpis.totalItems}</p>
        </CardContent></Card>
      </div>

      {/* Totals by currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.currencyTotals.map(c => (
          <Card key={c.currency}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Totals — {c.currency}</p>
                <Badge variant="outline" className="text-xs">{c.count} quotes</Badge>
              </div>
              <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(c.total, c.currency)}</p>
              <p className="text-xs text-success">Won: {formatCurrency(c.accepted, c.currency)}</p>
            </CardContent>
          </Card>
        ))}
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
          <div ref={chartsRef} className="space-y-6">
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
              {/* Status value bar — stacked per currency */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Value by Status (per currency)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={statusValueByCurrency.rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {statusValueByCurrency.currencies.map((cur, i) => (
                        <Bar key={cur} dataKey={cur} name={cur} stackId="value" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
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
          </div>
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
                      <TableHead>Currency</TableHead>
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
                        <TableCell><Badge variant="outline" className="text-xs">{c.currency}</Badge></TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{c.acceptedCount}</TableCell>
                        <TableCell className="text-right">{c.count > 0 ? ((c.acceptedCount / c.count) * 100).toFixed(0) : 0}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalValue, c.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.acceptedValue, c.currency)}</TableCell>
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
                      <TableHead>Currency</TableHead>
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
                        <TableCell><Badge variant="outline" className="text-xs">{s.currency}</Badge></TableCell>
                        <TableCell className="text-right">{s.quoteCount}</TableCell>
                        <TableCell className="text-right">{s.totalQty.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.avgPrice, s.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.totalRevenue, s.currency)}</TableCell>
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
