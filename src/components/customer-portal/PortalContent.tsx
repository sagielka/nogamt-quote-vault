import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProductCatalog, PRICE_LISTS, type PriceList } from '@/data/product-catalog';
import {
  CUSTOM_PREFIX,
  fetchCustomPriceList,
  fetchCustomPriceListItems,
  type CustomPriceList,
  type CustomPriceRow,
} from '@/hooks/useCustomPriceLists';
import { US_PRICE_TIERS, isUsPriceBreakItem, getTierNetUnitPrice, formatDate, calculateTotal } from '@/lib/quotation-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, ChevronDown, ChevronRight, ChevronLeft, List, LayoutGrid, Eye, Download, Mail } from 'lucide-react';
import { downloadQuotationPdf, getQuotationPdfBase64 } from '@/lib/pdf-generator';
import { dbRowToQuotation } from '@/hooks/useQuotations';
import { useToast } from '@/hooks/use-toast';
import { PortalStats, type PortalQuoteRow } from './PortalStats';
import { PortalQuoteDialog } from './PortalQuoteDialog';
import { PortalTeam } from './PortalTeam';
import * as XLSX from 'xlsx';
import { ProductMediaThumb } from '@/components/product-media/ProductMediaThumb';

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', ILS: '₪' };

interface Props {
  rawList: string | null;
  email: string;
  /** Hide the team management tab (e.g. staff previewing a customer's portal). */
  showTeam?: boolean;
}

export const PortalContent = ({ rawList, email, showTeam = true }: Props) => {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<PortalQuoteRow[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [quoteScope, setQuoteScope] = useState<'mine' | 'company'>('mine');
  const [busyQuote, setBusyQuote] = useState<string | null>(null);
  const { toast } = useToast();
  const sliderRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo(() => getProductCatalog(), []);
  const customListId = rawList?.startsWith(CUSTOM_PREFIX) ? rawList.slice(CUSTOM_PREFIX.length) : null;
  const priceList = (customListId ? null : rawList) as PriceList | null;
  const [customList, setCustomList] = useState<CustomPriceList | null>(null);
  const [customRows, setCustomRows] = useState<CustomPriceRow[]>([]);

  const baseCurrency = customListId
    ? customList?.currency || 'USD'
    : priceList
      ? PRICE_LISTS.find((p) => p.value === priceList)?.baseCurrency || 'USD'
      : 'USD';
  const symbol = SYMBOLS[baseCurrency] || '$';

  useEffect(() => {
    if (!customListId) return;
    (async () => {
      const [list, items] = await Promise.all([
        fetchCustomPriceList(customListId),
        fetchCustomPriceListItems(customListId),
      ]);
      setCustomList(list);
      setCustomRows(items);
    })();
  }, [customListId]);

  useEffect(() => {
    if (!email) return;
    (async () => {
      // Include colleagues on the same portal account (shared company account)
      let emails = [email.toLowerCase()];
      const companies: string[] = [];
      const { data: me } = await supabase
        .from('customer_accounts')
        .select('id, parent_account_id')
        .ilike('email', email)
        .maybeSingle();
      if (me) {
        const rootId = (me as any).parent_account_id || (me as any).id;
        const { data: fam } = await supabase
          .from('customer_accounts')
          .select('email, company_name')
          .or(`id.eq.${rootId},parent_account_id.eq.${rootId}`);
        if (fam?.length) {
          emails = Array.from(new Set(fam.map((f: any) => String(f.email).toLowerCase()).concat(emails)));
          fam.forEach((f: any) => {
            if (f.company_name && !companies.includes(f.company_name)) companies.push(f.company_name);
          });
        }
      }
      // Company names from the customers directory linked to any of these emails
      const { data: custRows } = await supabase.from('customers').select('name, email');
      (custRows || []).forEach((c: any) => {
        const addrs = String(c.email || '').split(',').map((s) => s.trim().toLowerCase());
        if (addrs.some((a) => emails.includes(a)) && c.name && !companies.includes(c.name)) {
          companies.push(c.name);
        }
      });

      const filters = [
        ...emails.map((e) => `client_email.ilike.%${e}%`),
        ...companies.map((c) => `client_name.ilike.${c}`),
      ];
      const { data } = await supabase
        .from('quotations')
        .select('*')
        .or(filters.join(','))
        .order('created_at', { ascending: false });
      setQuotes((data as any) || []);
    })();
  }, [email]);

  const myQuotes = useMemo(
    () =>
      quotes.filter((q: any) =>
        String(q.client_email || '')
          .split(',')
          .some((a) => a.trim().toLowerCase() === email.toLowerCase())
      ),
    [quotes, email]
  );
  const visibleQuotes = quoteScope === 'mine' ? myQuotes : quotes;

  const downloadQuote = async (row: any) => {
    setBusyQuote(row.id);
    try {
      const res = await downloadQuotationPdf(dbRowToQuotation(row));
      if (!res.success) throw new Error(res.error || 'Failed to generate PDF');
      toast({ title: 'Downloaded', description: res.fileName });
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyQuote(null);
    }
  };

  const emailQuote = async (row: any) => {
    setBusyQuote(row.id);
    try {
      const quotation = dbRowToQuotation(row);
      const { base64 } = await getQuotationPdfBase64(quotation);
      const total = calculateTotal(
        quotation.items as any,
        quotation.taxRate,
        quotation.discountType as any,
        quotation.discountValue
      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const { data, error } = await supabase.functions.invoke('send-quotation-email', {
        body: {
          to: email,
          recipients: [email],
          clientName: quotation.clientName,
          quoteNumber: quotation.quoteNumber,
          total: `${total} ${quotation.currency}`,
          validUntil: formatDate(quotation.validUntil),
          pdfBase64: base64,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Email sent', description: `${quotation.quoteNumber} was sent to ${email}.` });
    } catch (e: any) {
      toast({ title: 'Sending failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyQuote(null);
    }
  };





  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = customListId
      ? customRows.map((r) => ({
          sku: r.sku,
          description: r.description || '',
          prices: {} as any,
          customPrice: r.price,
        }))
      : catalog.filter((p) => (priceList ? p.prices[priceList] != null : false));
    if (!q) return rows as any[];
    return (rows as any[]).filter(
      (p) => p.sku.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [catalog, query, priceList, customListId, customRows]);

  const fmt = (v: number) =>
    `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportExcel = () => {
    const rows = filtered.map((p: any) => {
      const unit = (customListId ? p.customPrice : p.prices[priceList as PriceList]) as number;
      const item: any = { sku: p.sku, description: p.description, unitPrice: unit, discountPercent: 0 };
      const row: Record<string, any> = {
        'Item number': p.sku,
        Description: p.description || '',
        Currency: baseCurrency,
        'Unit price': Number(unit?.toFixed?.(2) ?? unit),
      };
      if (isUsPriceBreakItem(item)) {
        US_PRICE_TIERS.forEach((qty) => {
          row[`${qty} pcs`] = Number(getTierNetUnitPrice(item, qty).toFixed(2));
        });
      }
      return row;
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 10 }, { wch: 14 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Price list');
    const listName = (customListId ? customList?.name : PRICE_LISTS.find((p) => p.value === priceList)?.label) || 'price-list';
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(book, `NOGA-MT_${listName.replace(/[^\w-]+/g, '-')}_${stamp}.xlsx`);
  };

  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="prices">Price list</TabsTrigger>
        <TabsTrigger value="quotes">My quotations ({quotes.length})</TabsTrigger>
        {showTeam && <TabsTrigger value="team">Team</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview">
        <PortalStats quotes={quotes} />
      </TabsContent>


      <TabsContent value="prices">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by item number or description…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1 self-start">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={viewMode === 'cards'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Slide
            </button>
          </div>
          <Button variant="outline" size="sm" className="self-start" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Download Excel
          </Button>
        </div>


        {viewMode === 'cards' ? (
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''} — swipe or drag to browse
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => sliderRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => sliderRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div ref={sliderRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth">
              {filtered.map((p) => {
                const unit = (customListId ? p.customPrice : p.prices[priceList as PriceList]) as number;
                const item: any = { sku: p.sku, description: p.description, unitPrice: unit, discountPercent: 0 };
                const hasBreaks = isUsPriceBreakItem(item);
                return (
                  <div key={p.sku} className="snap-start shrink-0 w-[260px] rounded-lg border border-border bg-card p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <ProductMediaThumb sku={p.sku} description={p.description} size={44} />
                      <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                    </div>
                    <div className="text-sm font-medium leading-tight mb-3">{p.description}</div>
                    <div className="mt-auto">
                      <div className="text-2xl font-semibold text-right text-foreground">{fmt(unit)}</div>
                      {hasBreaks && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-muted-foreground">Quantity price breaks</p>
                          <div className="grid grid-cols-2 gap-2">
                            {US_PRICE_TIERS.map((qty) => (
                              <div key={qty} className="rounded border border-border bg-background px-2 py-1 text-center">
                                <div className="text-[11px] text-muted-foreground">{qty} pcs</div>
                                <div className="text-sm font-medium">{fmt(getTierNetUnitPrice(item, qty))}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="w-full text-center text-muted-foreground py-8">No items match your search.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium w-8"></th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Unit price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const unit = (customListId ? p.customPrice : p.prices[priceList as PriceList]) as number;
                  const item: any = { sku: p.sku, description: p.description, unitPrice: unit, discountPercent: 0 };
                  const hasBreaks = isUsPriceBreakItem(item);
                  const open = expanded === p.sku;
                  return (
                    <tr key={p.sku} className="border-t border-border align-top">
                      <td colSpan={4} className="p-0">
                        <div
                          className={`grid grid-cols-[2rem_10rem_1fr_8rem] items-center hover:bg-muted/30 ${hasBreaks ? 'cursor-pointer' : ''}`}
                          onClick={() => hasBreaks && setExpanded(open ? null : p.sku)}
                        >
                          <div className="px-3 py-1.5 text-muted-foreground">
                            {hasBreaks ? (open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                          </div>
                          <div className="px-3 py-1.5 font-mono text-xs flex items-center gap-2">
                            <ProductMediaThumb sku={p.sku} description={p.description} size={28} />
                            {p.sku}
                          </div>
                          <div className="px-3 py-1.5">{p.description}</div>
                          <div className="px-3 py-1.5 text-right font-medium">{fmt(unit)}</div>
                        </div>
                        {hasBreaks && open && (
                          <div className="bg-muted/20 border-t border-border px-3 py-2">
                            <p className="text-xs text-muted-foreground mb-1">Quantity price breaks</p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                              {US_PRICE_TIERS.map((qty) => (
                                <div key={qty} className="rounded border border-border bg-background px-2 py-1 text-center">
                                  <div className="text-[11px] text-muted-foreground">{qty} pcs</div>
                                  <div className="text-sm font-medium">{fmt(getTierNetUnitPrice(item, qty))}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No items match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="quotes">
        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            variant={quoteScope === 'mine' ? 'default' : 'outline'}
            onClick={() => setQuoteScope('mine')}
          >
            Received by me ({myQuotes.length})
          </Button>
          <Button
            size="sm"
            variant={quoteScope === 'company' ? 'default' : 'outline'}
            onClick={() => setQuoteScope('company')}
          >
            All company quotes ({quotes.length})
          </Button>
        </div>
        {visibleQuotes.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              No quotations have been issued to your email yet.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Quote</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Valid until</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibleQuotes.map((q) => (
                  <tr
                    key={q.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedQuote(q)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{q.quote_number}</td>
                    <td className="px-3 py-2">{formatDate(new Date(q.created_at))}</td>
                    <td className="px-3 py-2">{formatDate(new Date(q.valid_until))}</td>
                    <td className="px-3 py-2 capitalize">{q.status || '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {calculateTotal(
                        Array.isArray(q.items) ? q.items : [],
                        q.tax_rate || 0,
                        (q.discount_type as any) || 'percentage',
                        q.discount_value || 0
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      {q.currency}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedQuote(q); }}>
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyQuote === q.id}
                        onClick={(e) => { e.stopPropagation(); downloadQuote(q); }}
                      >
                        <Download className="w-4 h-4 mr-1" /> PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyQuote === q.id}
                        onClick={(e) => { e.stopPropagation(); emailQuote(q); }}
                      >
                        <Mail className="w-4 h-4 mr-1" /> Email me
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PortalQuoteDialog quote={selectedQuote} onOpenChange={(o) => !o && setSelectedQuote(null)} />
      </TabsContent>


      {showTeam && (
        <TabsContent value="team">
          <PortalTeam />
        </TabsContent>
      )}
    </Tabs>

  );
};
