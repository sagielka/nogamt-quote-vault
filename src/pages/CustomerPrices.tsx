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

  // Admin/staff: load approved customer accounts so they can browse the portal directly
  useEffect(() => {
    if (!user || !canManagePortal) return;
    setAccountsLoading(true);
    (async () => {
      const { data } = await (supabase
        .from('customer_accounts' as any)
        .select('id, email, company_name, price_list, status')
        .eq('status', 'approved')
        .not('price_list', 'is', null)
        .order('company_name', { ascending: true }) as any);
      const rows = (data as any[]) || [];
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

