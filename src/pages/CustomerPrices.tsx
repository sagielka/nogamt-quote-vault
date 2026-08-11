import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerAccount } from '@/hooks/useCustomerAccount';
import { usePermissions } from '@/hooks/usePermissions';
import { PRICE_LISTS, type PriceList } from '@/data/product-catalog';
import { CUSTOM_PREFIX, fetchCustomPriceList, type CustomPriceList } from '@/hooks/useCustomPriceLists';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { PortalContent } from '@/components/customer-portal/PortalContent';
import logo from '@/assets/logo.jpg';

const CustomerPrices = () => {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { account, loading: accountLoading, createAccount } = useCustomerAccount();
  const { can, isAdmin } = usePermissions();
  const canManagePortal = can('price_portal');
  const { toast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Admin/staff portal browsing state
  const [portalAccounts, setPortalAccounts] = useState<Array<{ id: string; email: string; company_name: string | null; price_list: string | null; status: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountsLoading, setAccountsLoading] = useState(false);

  const rawList = account?.price_list || null;
  const customListId = rawList?.startsWith(CUSTOM_PREFIX) ? rawList.slice(CUSTOM_PREFIX.length) : null;
  const priceList = (customListId ? null : rawList) as PriceList | null;
  const [customList, setCustomList] = useState<CustomPriceList | null>(null);

  const approved = account?.status === 'approved' && !!rawList;
  const listLabel = customListId
    ? customList?.name || 'Custom price list'
    : PRICE_LISTS.find((p) => p.value === priceList)?.label;

  useEffect(() => {
    if (!customListId) return;
    (async () => setCustomList(await fetchCustomPriceList(customListId)))();
  }, [customListId]);

  // Admin/staff: load portal accounts + all customers so they can browse any portal
  const [staffOverrideList, setStaffOverrideList] = useState<string>('');
  useEffect(() => {
    if (!user || !canManagePortal) return;
    setAccountsLoading(true);
    (async () => {
      const [accRes, custRes] = await Promise.all([
        (supabase
          .from('customer_accounts' as any)
          .select('id, email, company_name, price_list, status')
          .order('company_name', { ascending: true }) as any),
        (supabase
          .from('customers' as any)
          .select('id, name, email, price_list')
          .order('name', { ascending: true }) as any),
      ]);
      const accounts = ((accRes.data as any[]) || []).map((a) => ({
        id: `acct:${a.id}`,
        email: a.email,
        company_name: a.company_name,
        price_list: a.price_list,
        status: a.status,
      }));
      const accountEmails = new Set(accounts.map((a) => (a.email || '').toLowerCase()));
      const customers = ((custRes.data as any[]) || [])
        .filter((c) => c.email && !accountEmails.has(String(c.email).split(/[,;]/)[0].trim().toLowerCase()))
        .map((c) => ({
          id: `cust:${c.id}`,
          email: String(c.email).split(/[,;]/)[0].trim(),
          company_name: c.name,
          price_list: c.price_list,
          status: 'customer',
        }));
      const rows = [...accounts, ...customers];
      setPortalAccounts(rows);
      if (rows.length > 0 && !selectedAccountId) setSelectedAccountId(rows[0].id);
      setAccountsLoading(false);
    })();
  }, [user, canManagePortal]);

  const selectedAccount = portalAccounts.find((a) => a.id === selectedAccountId) || null;




  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          if (/already registered/i.test(error.message)) {
            setNotice('This email is already registered. Please sign in instead.');
            setMode('signin');
            return;
          }
          throw error;
        }
        // Auto-confirm is enabled: the user is signed in right away and
        // continues to the registration details step.
        setNotice('');
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
    <PortalShell user={user} onSignOut={() => signOut()}>{children}</PortalShell>
  );


  // Admin/staff with price_portal permission: browse customer portals directly
  if (user && canManagePortal && !approved) {
    const selectedRawList = staffOverrideList || selectedAccount?.price_list || null;
    return (
      <Shell>
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => window.location.hash = '#/'}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
          <ShieldCheck className="w-5 h-5 text-primary ml-auto" />
          <h1 className="heading-display text-2xl">Customer Price Portal</h1>
          <Badge variant="secondary" className="ml-2">Staff view</Badge>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <Label className="text-xs text-muted-foreground shrink-0">Viewing as</Label>
            {accountsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : portalAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers found yet.</p>
            ) : (
              <Select
                value={selectedAccountId}
                onValueChange={(v) => {
                  setSelectedAccountId(v);
                  setStaffOverrideList('');
                }}
              >
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Select a customer…" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {portalAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.company_name || a.email} — {a.email}
                      {a.status !== 'approved' ? ` (${a.status})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Label className="text-xs text-muted-foreground shrink-0 sm:ml-4">Price list</Label>
            <Select value={staffOverrideList} onValueChange={setStaffOverrideList}>
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue placeholder={selectedAccount?.price_list || 'Choose a price list…'} />
              </SelectTrigger>
              <SelectContent>
                {PRICE_LISTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedAccount && selectedRawList ? (
          <PortalContent rawList={selectedRawList} email={selectedAccount.email} showTeam={false} />
        ) : (
          !accountsLoading && portalAccounts.length > 0 && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                This customer has no price list assigned — pick one above to preview their portal.
              </CardContent>
            </Card>
          )
        )}

      </Shell>
    );
  }

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
          {account.company_name || 'Your'} portal
        </h1>
        <Badge variant="secondary" className="ml-2">
          {listLabel}
        </Badge>
      </div>

      <PortalContent rawList={rawList} email={user.email as string} />
    </Shell>
  );
};

export default CustomerPrices;

