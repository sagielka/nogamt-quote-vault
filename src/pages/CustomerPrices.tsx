import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerAccount } from '@/hooks/useCustomerAccount';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, LogOut, Clock, ShieldCheck, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import logo from '@/assets/logo.jpg';

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', ILS: '₪' };

const CustomerPrices = () => {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { account, loading: accountLoading, createAccount } = useCustomerAccount();
  const { toast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);

  const catalog = useMemo(() => getProductCatalog(), []);
  const rawList = account?.price_list || null;
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
  const approved = account?.status === 'approved' && !!rawList;
  const listLabel = customListId
    ? customList?.name || 'Custom price list'
    : PRICE_LISTS.find((p) => p.value === priceList)?.label;

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
    if (!approved || !user?.email) return;
    (async () => {
      const { data } = await supabase
        .from('quotations')
        .select('*')
        .ilike('client_email', user.email as string)
        .order('created_at', { ascending: false });
      setQuotes(data || []);
    })();
  }, [approved, user?.email]);

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
    return (rows as any[])
      .filter((p) => p.sku.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [catalog, query, priceList, customListId, customRows]);

  const fmt = (v: number) =>
    `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email.trim(), password);
        if (error) throw error;
        setNotice('Account created. Please check your email to confirm, then sign in to complete your registration.');
        setMode('signin');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await createAccount(company.trim(), contact.trim());
    setBusy(false);
    if (error) {
      toast({ title: 'Error', description: (error as any).message, variant: 'destructive' });
    } else {
      toast({ title: 'Request submitted', description: 'Your account is awaiting approval.' });
    }
  };

  if (authLoading || (user && accountLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Noga Engineering logo" className="h-10 w-auto" />
            <Badge variant="outline">Customer Price Portal</Badge>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="container py-8">{children}</main>
      <footer className="text-center pb-8 text-xs text-muted-foreground">
        <p className="font-semibold">Noga Engineering &amp; Technology Ltd.</p>
        <p>Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
      </footer>
    </div>
  );

  // Not signed in
  if (!user) {
    return (
      <Shell>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8">
            <h1 className="heading-display text-2xl mb-1">
              {mode === 'signin' ? 'Sign in to your price portal' : 'Request portal access'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              New accounts are reviewed by Noga before prices become visible.
            </p>
            {notice && <p className="mb-4 text-sm text-primary">{notice}</p>}
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
            <button
              className="mt-4 text-sm text-primary hover:underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? "Don't have an account? Register" : 'Already registered? Sign in'}
            </button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Signed in but no account record yet
  if (!account) {
    return (
      <Shell>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8">
            <h1 className="heading-display text-2xl mb-1">Complete your registration</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Tell us who you are. Noga will review your request and assign your price list.
            </p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="company">Company name</Label>
                <Input id="company" required value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contact">Contact name</Label>
                <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit for approval
              </Button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Pending / rejected / approved without a price list
  if (!approved) {
    return (
      <Shell>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Clock className="w-10 h-10 mx-auto text-muted-foreground/60 mb-4" />
            <h1 className="heading-display text-xl mb-2">
              {account.status === 'rejected' ? 'Access not approved' : 'Awaiting approval'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {account.status === 'rejected'
                ? 'Your request was not approved. Please contact your Noga representative.'
                : 'Your account is under review. Once approved, your personal price list will appear here.'}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h1 className="heading-display text-2xl">
          {account.company_name || 'Your'} prices
        </h1>
        <Badge variant="secondary" className="ml-2">
          {listLabel}
        </Badge>
      </div>

      <Tabs defaultValue="prices">
        <TabsList className="mb-4">
          <TabsTrigger value="prices">Price list</TabsTrigger>
          <TabsTrigger value="quotes">My quotations ({quotes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prices">
          <div className="relative mb-3 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by item number or description…"
              className="pl-9"
            />
          </div>
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
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
                          <div className="px-3 py-1.5 font-mono text-xs">{p.sku}</div>
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
        </TabsContent>

        <TabsContent value="quotes">
          {quotes.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{q.quote_number}</td>
                      <td className="px-3 py-2">{formatDate(new Date(q.created_at))}</td>
                      <td className="px-3 py-2">{formatDate(new Date(q.valid_until))}</td>
                      <td className="px-3 py-2 capitalize">{q.status || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {calculateTotal(
                          Array.isArray(q.items) ? q.items : [],
                          q.tax_rate || 0,
                          q.discount_type || 'percentage',
                          q.discount_value || 0
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        {q.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Shell>
  );
};

export default CustomerPrices;
