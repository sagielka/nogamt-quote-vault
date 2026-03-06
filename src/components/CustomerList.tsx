import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Mail,
  MapPin,
  FileText,
  Users,
  Download,
  Send,
  SendHorizonal,
} from 'lucide-react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string | null;
  created_at: string;
  quotation_count?: number;
}

interface CustomerListProps {
  onSelectCustomer?: (email: string) => void;
}

export const CustomerList = ({ onSelectCustomer }: CustomerListProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<Customer[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;

      // Get quotation counts per client email
      const { data: quotations } = await supabase
        .from('quotations')
        .select('client_email');

      const countMap: Record<string, number> = {};
      quotations?.forEach((q: any) => {
        const e = q.client_email?.toLowerCase();
        if (e) countMap[e] = (countMap[e] || 0) + 1;
      });

      const enriched = (data || []).map((c: any) => ({
        ...c,
        quotation_count: countMap[c.email?.toLowerCase()] || 0,
      }));

      setCustomers(enriched);
    } catch {
      toast({ title: 'Error', description: 'Failed to load customers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const exportCustomers = () => {
    const data = filtered.length > 0 ? filtered : customers;
    if (data.length === 0) return;

    const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = 'Name,Email,Address,Quotations';
    const rows = data.map((c) =>
      [escape(c.name), escape(c.email), escape(c.address || ''), c.quotation_count ?? 0].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${data.length} customers exported to CSV.` });
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
    setAddress('');
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setEmail(customer.email);
    setAddress(customer.address || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Validation Error', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({ name: name.trim(), email: email.trim(), address: address.trim() || null })
          .eq('id', editingCustomer.id);
        if (error) throw error;
        toast({ title: 'Customer Updated', description: `${name} has been updated.` });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({ name: name.trim(), email: email.trim(), address: address.trim() || null, user_id: user!.id });
        if (error) throw error;
        toast({ title: 'Customer Created', description: `${name} has been added.` });
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save customer.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomerId) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', deletingCustomerId);
      if (error) throw error;
      toast({ title: 'Customer Deleted', description: 'Customer has been removed.' });
      setDeleteDialogOpen(false);
      setDeletingCustomerId(null);
      fetchCustomers();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete customer.', variant: 'destructive' });
    }
  };

  const openEmailDialog = (recipients: Customer[]) => {
    setEmailRecipients(recipients);
    setEmailSubject('');
    setEmailMessage('');
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast({ title: 'Validation Error', description: 'Subject and message are required.', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token || !projectId) throw new Error('Not authenticated');

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-customer-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipients: emailRecipients.map((c) => ({ email: c.email, name: c.name })),
            subject: emailSubject.trim(),
            message: emailMessage.trim(),
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      const skippedMsg = result.skipped > 0 ? ` (${result.skipped} unsubscribed, skipped)` : '';
      toast({ title: 'Email Sent', description: `Successfully sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}${skippedMsg}.` });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send email.', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-muted-foreground" />
          <h2 className="heading-display text-2xl text-foreground">Customers</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
          <Button size="sm" variant="outline" onClick={() => exportCustomers()}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {filtered.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => openEmailDialog(filtered)}>
              <SendHorizonal className="w-4 h-4 mr-2" />
              Email All ({filtered.length})
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            {searchQuery ? `No customers match "${searchQuery}"` : 'No customers yet'}
          </h3>
          {!searchQuery && (
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add your first customer to get started
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => (
            <Card 
              key={customer.id} 
              className="group hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => onSelectCustomer?.(customer.email)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-sm truncate flex-1 mr-2">
                    {customer.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); openEmailDialog([customer]); }}
                      title="Send email"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); openEdit(customer); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCustomerId(customer.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>
                      {customer.quotation_count} quotation{customer.quotation_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCustomer ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the customer from your saved list. Existing quotations will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Compose Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {emailRecipients.length === 1
                ? `Email ${emailRecipients[0].name}`
                : `Email ${emailRecipients.length} Customers`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <p className="text-sm text-foreground mt-1">
                {emailRecipients.length === 1
                  ? `${emailRecipients[0].name} <${emailRecipients[0].email}>`
                  : `${emailRecipients.length} recipients`}
              </p>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
                maxLength={200}
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Write your message..."
                rows={6}
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground mt-1">{emailMessage.length}/5000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {sendingEmail ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
