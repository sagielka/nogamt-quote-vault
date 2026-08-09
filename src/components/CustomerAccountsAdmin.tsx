import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PRICE_LISTS } from '@/data/product-catalog';
import { useCustomPriceLists, CUSTOM_PREFIX } from '@/hooks/useCustomPriceLists';
import PriceListUploader from '@/components/PriceListUploader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, UserCheck, UserX, Pencil, KeyRound, Mail, UserPlus } from 'lucide-react';

interface Row {
  id: string;
  user_id: string;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  status: string;
  price_list: string | null;
  notes: string | null;
  created_at: string;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

export const CustomerAccountsAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lists: customLists } = useCustomPriceLists();
  const priceListOptions = [
    ...PRICE_LISTS.map((p) => ({ value: p.value as string, label: p.label })),
    ...customLists.map((l) => ({ value: `${CUSTOM_PREFIX}${l.id}`, label: `${l.name} (custom · ${l.currency})` })),
  ];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ company_name: '', contact_name: '', notes: '', price_list: '' });
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: '',
    email: '',
    company_name: '',
    contact_name: '',
    price_list: '',
    password: '',
    notes: '',
  });


  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('customer_accounts' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any);
    setRows((data || []) as Row[]);
    setLoading(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .order('name', { ascending: true });
    setCustomers((data || []) as CustomerOption[]);
  }, []);

  useEffect(() => {
    load();
    loadCustomers();
  }, [load, loadCustomers]);


  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await (supabase
      .from('customer_accounts' as any)
      .update(values as any)
      .eq('id', id) as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await load();
    return true;
  };

  const approve = (row: Row) => {
    if (!row.price_list) {
      toast({ title: 'Choose a price list first', description: 'Assign a price list before approving.', variant: 'destructive' });
      return;
    }
    patch(row.id, { status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() });
    toast({ title: 'Customer approved', description: `${row.email} can now see their prices.` });
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setNewPassword('');
    setForm({
      company_name: row.company_name || '',
      contact_name: row.contact_name || '',
      notes: row.notes || '',
      price_list: row.price_list || '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const ok = await patch(editing.id, {
      company_name: form.company_name || null,
      contact_name: form.contact_name || null,
      notes: form.notes || null,
      price_list: form.price_list || null,
    });
    setBusy(false);
    if (ok) {
      toast({ title: 'Saved', description: 'Customer details updated.' });
      setEditing(null);
    }
  };

  const callAdmin = async (action: string, body: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke(`admin-users?action=${action}`, {
      body,
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (res.error) throw new Error(res.error.message);
    if ((res.data as any)?.error) throw new Error((res.data as any).error);
    return res.data as any;
  };

  const sendReset = async (row: Row) => {
    setBusy(true);
    try {
      await callAdmin('reset-password', { email: row.email });
      toast({ title: 'Reset email sent', description: `Password reset sent to ${row.email}.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const setPassword = async () => {
    if (!editing) return;
    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await callAdmin('set-password', { userId: editing.user_id, password: newPassword });
      setNewPassword('');
      toast({ title: 'Password updated', description: `New password set for ${editing.email}.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    const firstEmail = (c?.email || '').split(/[,;]/)[0].trim();
    setCreateForm((f) => ({
      ...f,
      customerId: id,
      email: firstEmail,
      company_name: c?.name || '',
    }));
  };

  const createPortalUser = async () => {
    if (!createForm.email || !createForm.price_list) {
      toast({ title: 'Missing details', description: 'Email and price list are required.', variant: 'destructive' });
      return;
    }
    if (createForm.password && createForm.password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await callAdmin('create-portal-user', {
        email: createForm.email.trim(),
        password: createForm.password || undefined,
        companyName: createForm.company_name || null,
        contactName: createForm.contact_name || null,
        priceList: createForm.price_list,
        notes: createForm.notes || null,
      });
      toast({ title: 'Portal user created', description: `${createForm.email} is approved with the ${createForm.price_list} price list.` });
      setCreateOpen(false);
      setCreateForm({ customerId: '', email: '', company_name: '', contact_name: '', price_list: '', password: '', notes: '' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="heading-display text-xl">Customer Portal Accounts</h2>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} accounts</span>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          New portal user
        </Button>
      </div>

      <PriceListUploader />


      {rows.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No customers have requested portal access yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{row.company_name || '—'}</span>
                  {statusBadge(row.status)}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {row.email}
                  {row.contact_name ? ` · ${row.contact_name}` : ''}
                </p>
              </div>

              <Select
                value={row.price_list || undefined}
                onValueChange={(v) => patch(row.id, { price_list: v })}
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Assign price list" />
                </SelectTrigger>
                <SelectContent>
                  {priceListOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => sendReset(row)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Reset link
                </Button>
                {row.status !== 'approved' && (
                  <Button size="sm" onClick={() => approve(row)}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                )}
                {row.status !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => patch(row.id, { status: 'rejected' })}>
                    <UserX className="w-4 h-4 mr-2" />
                    {row.status === 'approved' ? 'Revoke' : 'Reject'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price list</Label>
              <Select value={form.price_list || undefined} onValueChange={(v) => setForm({ ...form, price_list: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign price list" />
                </SelectTrigger>
                <SelectContent>
                  {priceListOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Internal notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Set a new password
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button variant="secondary" disabled={busy || !newPassword} onClick={setPassword}>
                  Apply
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Or use “Reset link” to email the customer a self-service reset.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New portal user</DialogTitle>
            <DialogDescription>
              Pick an existing customer or type a new email, then assign a price list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Choose from customers</Label>
              <Select value={createForm.customerId || undefined} onValueChange={pickCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an existing customer (optional)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {(c.email || '').split(/[,;]/)[0].trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Login email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="customer@company.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company name</Label>
                <Input
                  value={createForm.company_name}
                  onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact name</Label>
                <Input
                  value={createForm.contact_name}
                  onChange={(e) => setCreateForm({ ...createForm, contact_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Price list *</Label>
              <Select
                value={createForm.price_list || undefined}
                onValueChange={(v) => setCreateForm({ ...createForm, price_list: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign price list" />
                </SelectTrigger>
                <SelectContent>
                  {priceListOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Initial password (optional)
              </Label>
              <Input
                type="text"
                placeholder="Leave empty to send a reset link later"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Internal notes</Label>
              <Textarea rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createPortalUser} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create &amp; approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default CustomerAccountsAdmin;
