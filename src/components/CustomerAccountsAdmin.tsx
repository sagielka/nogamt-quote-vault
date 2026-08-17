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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, ShieldCheck, UserCheck, UserX, Pencil, KeyRound, Mail, UserPlus, Link2, Eye, Users, Plus, Unlink, Split, Merge, Shield } from 'lucide-react';
import { PortalContent } from '@/components/customer-portal/PortalContent';


const PORTAL_URL = 'https://quote.noga-mt.com/#/price-list';

interface Row {
  id: string;
  user_id: string;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  status: string;
  price_list: string | null;
  notes: string | null;
  parent_account_id: string | null;
  is_account_admin?: boolean;
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
  const { lists: customLists, reload: reloadCustomLists } = useCustomPriceLists();
  const priceListOptions = [
    ...PRICE_LISTS.map((p) => ({ value: p.value as string, label: p.label })),
    ...customLists.map((l) => ({ value: `${CUSTOM_PREFIX}${l.id}`, label: `${l.name} (custom · ${l.currency})` })),
  ];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const [form, setForm] = useState({ company_name: '', contact_name: '', notes: '', price_list: '', is_account_admin: false });
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<Row | null>(null);
  const [approving, setApproving] = useState<Row | null>(null);
  const [approveAdmin, setApproveAdmin] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<Row | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [linkForm, setLinkForm] = useState({ email: '', contact_name: '', password: '' });
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

  const openApprove = (row: Row) => {
    if (!row.price_list) {
      toast({ title: 'Choose a price list first', description: 'Assign a price list before approving.', variant: 'destructive' });
      return;
    }
    setApproveAdmin(!row.parent_account_id || !!row.is_account_admin);
    setApproving(row);
  };

  const sendApprovalEmail = async (payload: { accountId?: string; email: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('notify-portal-approval', {
        body: payload,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      toast({ title: 'Approval email sent', description: `Confirmation emailed to ${payload.email}.` });
    } catch (e: any) {
      toast({
        title: 'Approval email not sent',
        description: `${payload.email} was approved, but the email could not be sent.`,
        variant: 'destructive',
      });
      console.error('notify-portal-approval failed', e);
    }
  };

  const confirmApprove = async () => {
    if (!approving) return;
    setBusy(true);
    const ok = await patch(approving.id, {
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      is_account_admin: approveAdmin,
    });
    setBusy(false);
    if (ok) {
      toast({
        title: 'Customer approved',
        description: `${approving.email} can now see their prices${approveAdmin ? ' and manage their team' : ''}.`,
      });
      sendApprovalEmail({ accountId: approving.id, email: approving.email });
      setApproving(null);
    }
  };

  const toggleAccountAdmin = async (row: Row) => {
    const next = !row.is_account_admin;
    const ok = await patch(row.id, { is_account_admin: next });
    if (ok) {
      toast({
        title: next ? 'Admin privileges granted' : 'Admin privileges removed',
        description: `${row.email} ${next ? 'can now revoke or delete other users' : 'can no longer manage other users'}.`,
      });
    }
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setNewPassword('');
    setForm({
      company_name: row.company_name || '',
      contact_name: row.contact_name || '',
      notes: row.notes || '',
      price_list: row.price_list || '',
      is_account_admin: !!row.is_account_admin,
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
      is_account_admin: form.is_account_admin,
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
    if (res.error) {
      // Surface the real message from the function's JSON body (e.g. invalid email)
      let msg = res.error.message;
      try {
        const ctx: any = (res.error as any).context;
        if (ctx?.json) {
          const j = await ctx.json();
          if (j?.error) msg = j.error;
        } else if (typeof ctx?.text === 'function') {
          const t = await ctx.text();
          const j = JSON.parse(t);
          if (j?.error) msg = j.error;
        }
      } catch { /* keep default message */ }
      throw new Error(msg);
    }
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
      sendApprovalEmail({ email: createForm.email.trim() });
      setCreateOpen(false);
      setCreateForm({ customerId: '', email: '', company_name: '', contact_name: '', price_list: '', password: '', notes: '' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyPortalLink = async (row?: Row) => {
    try {
      await navigator.clipboard.writeText(PORTAL_URL);
      toast({
        title: 'Link copied',
        description: row ? `Share with ${row.email}: ${PORTAL_URL}` : PORTAL_URL,
      });
    } catch {
      toast({ title: 'Portal link', description: PORTAL_URL });
    }
  };

  const emailPortalLink = (row: Row) => {
    const subject = encodeURIComponent('Your Noga price portal access');
    const body = encodeURIComponent(
      `Hello${row.contact_name ? ` ${row.contact_name}` : ''},\n\n` +
        `You can view your personal price list here:\n${PORTAL_URL}\n\n` +
        `Sign in with your email: ${row.email}\n\nBest regards,\nNoga Engineering & Technology Ltd.`
    );
    window.location.href = `mailto:${row.email}?subject=${subject}&body=${body}`;
  };

  const rootRows = rows.filter((r) => !r.parent_account_id);
  const membersOf = (id: string) => rows.filter((r) => r.parent_account_id === id);

  const domainOf = (e: string) => (e.split('@')[1] || '').trim().toLowerCase();

  const accountDomain = linkFor ? domainOf(linkFor.email) : '';

  // Emails already used by this account family (root + members)
  const familyEmails = linkFor
    ? rows
        .filter((r) => r.id === (linkFor.parent_account_id || linkFor.id) || r.parent_account_id === (linkFor.parent_account_id || linkFor.id))
        .map((r) => r.email.toLowerCase())
    : [];

  const isAllowedEmail = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) return false;
    const d = domainOf(e);
    return accountDomain ? d === accountDomain : false;
  };

  const knownEmails = Array.from(
    new Set(
      customers
        .flatMap((c) => (c.email || '').split(/[,;]/))
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  )
    .filter((e) => !rows.some((r) => r.email.toLowerCase() === e))
    .filter((e) => isAllowedEmail(e));


  const addLinkedEmail = async () => {
    if (!linkFor) return;
    const email = linkForm.email.trim().toLowerCase();
    if (!email) {
      toast({ title: 'Email required', description: 'Choose an existing email or type a new one.', variant: 'destructive' });
      return;
    }
    if (!isAllowedEmail(email)) {
      toast({
        title: 'Domain must stay the same',
        description: `Only addresses on @${accountDomain || 'the company domain'} can be added to this account.`,
        variant: 'destructive',
      });
      return;
    }

    if (linkForm.password && linkForm.password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await callAdmin('create-portal-user', {
        email,
        password: linkForm.password || undefined,
        contactName: linkForm.contact_name || null,
        companyName: linkFor.company_name,
        priceList: linkFor.price_list,
        parentAccountId: linkFor.id,
      });
      toast({
        title: 'Email linked',
        description: `${email} now shares the ${linkFor.company_name || linkFor.email} portal account.`,
      });
      setLinkFor(null);
      setLinkForm({ email: '', contact_name: '', password: '' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const unlinkEmail = async (member: Row) => {
    const ok = await patch(member.id, { parent_account_id: null, status: 'rejected' });
    if (ok) toast({ title: 'Access removed', description: `${member.email} no longer shares this account.` });
  };

  // Detach a linked user so they become their own standalone portal account
  const splitAccount = async (member: Row) => {
    const ok = await patch(member.id, { parent_account_id: null });
    if (ok) toast({ title: 'Account split', description: `${member.email} is now a separate portal account.` });
  };

  // Merge one root account (and everyone under it) into another company account
  const mergeAccounts = async () => {
    if (!mergeFrom || !mergeTargetId) return;
    setBusy(true);
    try {
      const target = rows.find((r) => r.id === mergeTargetId);
      const childIds = membersOf(mergeFrom.id).map((m) => m.id);
      if (childIds.length) {
        await (supabase.from('customer_accounts' as any).update({ parent_account_id: mergeTargetId } as any).in('id', childIds) as any);
      }
      const { error } = await (supabase
        .from('customer_accounts' as any)
        .update({
          parent_account_id: mergeTargetId,
          company_name: target?.company_name ?? mergeFrom.company_name,
          price_list: target?.price_list ?? mergeFrom.price_list,
        } as any)
        .eq('id', mergeFrom.id) as any);
      if (error) throw error;
      toast({
        title: 'Accounts merged',
        description: `${mergeFrom.email} now shares the ${target?.company_name || target?.email} account.`,
      });
      setMergeFrom(null);
      setMergeTargetId('');
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };



  // Permanently delete the login and the portal account record
  const deleteAccount = async (row: Row) => {
    setBusy(true);
    try {
      await callAdmin('delete-user', { userId: row.user_id });
      toast({ title: 'Account deleted', description: `${row.email} was permanently removed.` });
      setDeleteTarget(null);
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
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-black animate-pulse">Pending approval</Badge>;
  };

  const pendingCount = rows.filter((r) => r.status === 'pending').length;


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
        <span className="text-xs text-muted-foreground ml-auto">
          {rootRows.length} compan{rootRows.length !== 1 ? 'ies' : 'y'} · {rows.length} user{rows.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" variant="outline" onClick={() => window.open('/#/price-list', '_blank')}>
          <Eye className="w-4 h-4 mr-2" />
          Open customer portal
        </Button>
        <Button size="sm" variant="outline" onClick={() => copyPortalLink()}>
          <Link2 className="w-4 h-4 mr-2" />
          Copy portal link
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          New portal user
        </Button>

      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Shareable portal link</Label>
          <Input readOnly value={PORTAL_URL} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <Button size="sm" variant="secondary" onClick={() => copyPortalLink()}>Copy</Button>
        </CardContent>
      </Card>


      {pendingCount > 0 && (
        <Card className="border-amber-500/60 bg-amber-500/10">
          <CardContent className="p-4 text-sm">
            <span className="font-medium text-amber-500">
              {pendingCount} customer{pendingCount !== 1 ? 's are' : ' is'} waiting for approval
            </span>
            <span className="text-muted-foreground"> — review the highlighted accounts below.</span>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No customers have requested portal access yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rootRows.map((row) => (
          <Card
            key={row.id}
            className={row.status === 'pending' ? 'border-amber-500/70 bg-amber-500/5 ring-1 ring-amber-500/30' : undefined}
          >
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                <div className="flex-1 min-w-0 lg:min-w-[280px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium break-words">{row.company_name || '—'}</span>
                    {statusBadge(row.status)}
                    {row.is_account_admin && (
                      <Badge variant="outline" className="gap-1 border-primary/60 text-primary whitespace-nowrap">
                        <Shield className="w-3 h-3" /> Account admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground break-all">
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
                  <Button size="sm" variant="outline" onClick={() => setPreview(row)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View as customer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setLinkFor(row); setLinkForm({ email: '', contact_name: '', password: '' }); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add email
                  </Button>
                  {rootRows.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setMergeFrom(row); setMergeTargetId(''); }}
                    >
                      <Merge className="w-4 h-4 mr-2" />
                      Merge
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyPortalLink(row)}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Copy link
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => emailPortalLink(row)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email link
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => sendReset(row)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Reset link
                  </Button>
                  {row.status !== 'approved' && (
                    <Button size="sm" onClick={() => openApprove(row)}>
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
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => setDeleteTarget(row)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              {membersOf(row.id).length > 0 && (
                <div className="rounded-md border border-border/60 divide-y divide-border/60 overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/40 text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {membersOf(row.id).length} additional user{membersOf(row.id).length !== 1 ? 's' : ''} on this account
                  </div>
                  {membersOf(row.id).map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-2 flex flex-col xl:flex-row xl:items-center gap-2 text-xs"
                    >
                      <div className="min-w-0 xl:w-64">
                        <div className="font-medium break-all">{m.email}</div>
                        <div className="text-muted-foreground break-words">{m.contact_name || 'No name'}</div>
                      </div>

                      <div className="min-w-0 xl:w-48 text-muted-foreground truncate">
                        {priceListOptions.find((p) => p.value === m.price_list)?.label || 'No price list'}
                      </div>
                      <div className="text-muted-foreground xl:w-32 whitespace-nowrap">
                        added {new Date(m.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(m.status)}
                        {m.is_account_admin && (
                          <Badge variant="outline" className="gap-1 border-primary/60 text-primary">
                            <Shield className="w-3 h-3" /> Admin
                          </Badge>
                        )}
                      </div>
                      <div className="xl:ml-auto flex items-center gap-3 flex-wrap whitespace-nowrap">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                          onClick={() => toggleAccountAdmin(m)}
                        >
                          <Shield className="w-3 h-3" /> {m.is_account_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => openEdit(m)}>
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => sendReset(m)}>
                          <Mail className="w-3 h-3" /> Reset
                        </button>
                        <button type="button" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1" onClick={() => splitAccount(m)}>
                          <Split className="w-3 h-3" /> Split out
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                          onClick={() => unlinkEmail(m)}
                        >
                          <Unlink className="w-3 h-3" /> Remove
                        </button>
                        <button
                          type="button"
                          className="text-destructive/80 hover:text-destructive inline-flex items-center gap-1"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve portal access</DialogTitle>
            <DialogDescription>{approving?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Admin privileges</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Allow this user to add, revoke and delete other users on their company account.
              </p>
            </div>
            <Switch checked={approveAdmin} onCheckedChange={setApproveAdmin} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={confirmApprove} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mergeFrom} onOpenChange={(o) => !o && setMergeFrom(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge portal accounts</DialogTitle>
            <DialogDescription>
              {mergeFrom?.company_name || mergeFrom?.email} and everyone linked to it will move under the account you
              choose, and share its company name and price list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Merge into</Label>
            <Select value={mergeTargetId || undefined} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the main account to keep" />
              </SelectTrigger>
              <SelectContent>
                {rootRows
                  .filter((r) => r.id !== mergeFrom?.id)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {(r.company_name || '—') + ' · ' + r.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeFrom(null)}>Cancel</Button>
            <Button onClick={mergeAccounts} disabled={busy || !mergeTargetId}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.email} will be deleted completely — the login, the portal account and any
              roles or permissions. Users linked under this account become standalone accounts.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteAccount(deleteTarget); }}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer portal preview</DialogTitle>
            <DialogDescription>
              Exactly what {preview?.company_name || preview?.email} sees when signed in to the portal.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            preview.price_list ? (
              <PortalContent rawList={preview.price_list} email={preview.email} showTeam={false} />
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                No price list assigned yet — the customer sees an "awaiting approval" screen.
              </p>
            )
          )}
        </DialogContent>
      </Dialog>


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
            <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Admin privileges</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Can add, revoke and delete other users on this company's portal account.
                </p>
              </div>
              <Switch checked={form.is_account_admin} onCheckedChange={(v) => setForm({ ...form, is_account_admin: v })} />
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

      <Dialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add email to this portal account</DialogTitle>
            <DialogDescription>
              The new email signs in separately but shares {linkFor?.company_name || linkFor?.email}'s price list and quotations.
              The domain must stay the same.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-muted/40 p-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Allowed domain for this account</span>
              <Badge variant="outline" className="font-mono text-xs">@{accountDomain || '—'}</Badge>
            </div>

            <div className="space-y-1.5">
              <Label>Choose an existing customer email</Label>
              <Select value={linkForm.email || undefined} onValueChange={(v) => setLinkForm({ ...linkForm, email: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a known email (optional)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {knownEmails.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Or type an email *</Label>
              <Input
                type="email"
                placeholder={`colleague@${accountDomain || 'company.com'}`}
                value={linkForm.email}
                onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input
                value={linkForm.contact_name}
                onChange={(e) => setLinkForm({ ...linkForm, contact_name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Initial password (optional)
              </Label>
              <Input
                type="text"
                placeholder="Leave empty to send a reset link later"
                value={linkForm.password}
                onChange={(e) => setLinkForm({ ...linkForm, password: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkFor(null)}>Cancel</Button>
            <Button onClick={addLinkedEmail} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">

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

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Or upload a new price list and assign it to this user
              </p>
              <PriceListUploader
                compact
                onCreated={async (id) => {
                  await reloadCustomLists();
                  setCreateForm((f) => ({ ...f, price_list: `${CUSTOM_PREFIX}${id}` }));
                }}
              />
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

            <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Admin privileges</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Can add, revoke and delete other users on this company's portal account.
                </p>
              </div>
              <Switch checked={form.is_account_admin} onCheckedChange={(v) => setForm({ ...form, is_account_admin: v })} />
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
