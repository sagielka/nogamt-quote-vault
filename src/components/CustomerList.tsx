import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Eye,
  MapPin,
  FileText,
  Users,
  Download,
  Upload,
  Send,
  SendHorizonal,
  Paperclip,
  X,
  Save,
  BookmarkPlus,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Copy,
  ClipboardPaste,
  Undo,
  Redo,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EMAIL_TEMPLATES = [
  {
    id: 'follow-up',
    name: 'Follow Up',
    subject: 'NOGA MT - Follow Up on Our Recent Quotation',
    message: `Dear Customer,

I hope this message finds you well. I wanted to follow up on the quotation we recently sent you and check if you have any questions or need further clarification.

We would be happy to discuss any adjustments or provide additional information to help you make your decision.

Looking forward to hearing from you.`,
  },
  {
    id: 'new-products',
    name: 'New Products Announcement',
    subject: 'NOGA MT - Exciting New Products Available',
    message: `Dear Customer,

We are pleased to inform you about our latest product additions. We believe these new offerings could be valuable for your operations.

Please feel free to reach out if you would like to receive a detailed quotation or technical specifications for any of our products.

We look forward to the opportunity to serve you.`,
  },
  {
    id: 'price-update',
    name: 'Price Update Notice',
    subject: 'NOGA MT - Important Price Update Notice',
    message: `Dear Customer,

We are writing to inform you about upcoming changes to our pricing structure. These adjustments will take effect soon, and we wanted to give you advance notice.

If you would like to place an order at current pricing, please contact us at your earliest convenience.

Thank you for your continued partnership.`,
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    subject: 'NOGA MT - Thank You for Your Business',
    message: `Dear Customer,

Thank you for your recent order. We truly appreciate your business and trust in our products.

If you need any assistance or have questions about your order, please don't hesitate to reach out.

We look forward to continuing our partnership.`,
  },
  {
    id: 'reminder',
    name: 'Payment Reminder',
    subject: 'NOGA MT - Friendly Payment Reminder',
    message: `Dear Customer,

This is a friendly reminder regarding an outstanding payment on your account. We would appreciate your prompt attention to this matter.

If payment has already been made, please disregard this message. Otherwise, please let us know if you have any questions.

Thank you for your cooperation.`,
  },
];
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
  const [ccSelf, setCcSelf] = useState(false);
  const [ccField, setCcField] = useState('');
  const [bccField, setBccField] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; content: string; size: number }[]>([]);
  const [customTemplates, setCustomTemplates] = useState<{ id: string; name: string; subject: string; message: string }[]>([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [importing, setImporting] = useState(false);
  const { user } = useAuth();

  const execFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Sync content back to state
    if (editorRef.current) {
      setEmailMessage(editorRef.current.innerText);
    }
  }, []);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setEmailMessage(editorRef.current.innerText);
    }
  }, []);

  const getEditorHtml = useCallback(() => {
    return editorRef.current?.innerHTML || emailMessage.replace(/\n/g, '<br>');
  }, [emailMessage]);
  const { toast } = useToast();

  const allTemplates = useMemo(() => [
    ...EMAIL_TEMPLATES.map(t => ({ ...t, isCustom: false })),
    ...customTemplates.map(t => ({ ...t, isCustom: true })),
  ], [customTemplates]);

  const fetchCustomTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');
    if (data) {
      setCustomTemplates(data.map((t: any) => ({ id: t.id, name: t.name, subject: t.subject, message: t.message })));
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !emailSubject.trim() || !emailMessage.trim()) {
      toast({ title: 'Validation Error', description: 'Template name, subject, and message are required.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('email_templates').insert({
        user_id: user!.id,
        name: templateName.trim(),
        subject: emailSubject.trim(),
        message: emailMessage.trim(),
      });
      if (error) throw error;
      toast({ title: 'Template Saved', description: `"${templateName.trim()}" saved for future use.` });
      setSaveTemplateOpen(false);
      setTemplateName('');
      fetchCustomTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save template.', variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Template Deleted' });
      fetchCustomTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    }
  };

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

      const enriched = (data || []).map((c: any) => {
        const emails = (c.email || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
        const totalCount = emails.reduce((sum: number, e: string) => sum + (countMap[e] || 0), 0);
        return { ...c, quotation_count: totalCount };
      });

      setCustomers(enriched);
    } catch {
      toast({ title: 'Error', description: 'Failed to load customers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchCustomTemplates();
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

  const handleBatchImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const { importCustomers } = await import('@/data/import-customers');
      const existingEmails = new Set(customers.map(c => c.email.toLowerCase()));
      const newCustomers = importCustomers.filter(c => !existingEmails.has(c.email.toLowerCase()));
      
      if (newCustomers.length === 0) {
        toast({ title: 'No New Customers', description: 'All customers from the import list already exist.' });
        setImporting(false);
        return;
      }

      const rows = newCustomers.map(c => ({
        name: c.name,
        email: c.email,
        address: c.address || null,
        user_id: user.id,
      }));

      const { error } = await supabase.from('customers').insert(rows);
      if (error) throw error;

      toast({ title: 'Import Complete', description: `${newCustomers.length} new customers imported successfully.` });
      fetchCustomers();
    } catch (err: any) {
      toast({ title: 'Import Failed', description: err.message || 'Failed to import customers.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
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
    const emailList = email.split(',').map(e => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emailList.filter(e => !emailRegex.test(e));
    if (invalid.length > 0) {
      toast({ title: 'Invalid Email', description: `Invalid email(s): ${invalid.join(', ')}`, variant: 'destructive' });
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
    setAttachments([]);
    setCcField('');
    setBccField('');
    setEmailDialogOpen(true);
    // Clear editor content after dialog opens
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = '';
    }, 50);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 5 * 1024 * 1024; // 5MB per file
    const maxTotal = 10 * 1024 * 1024; // 10MB total

    const currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);

    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        toast({ title: 'File Too Large', description: `${file.name} exceeds 5MB limit.`, variant: 'destructive' });
        return;
      }
      if (currentTotal + file.size > maxTotal) {
        toast({ title: 'Total Size Exceeded', description: 'Attachments total cannot exceed 10MB.', variant: 'destructive' });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments((prev) => [...prev, { name: file.name, content: base64, size: file.size }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
            recipients: emailRecipients.flatMap((c) => {
              const emails = c.email.split(',').map(e => e.trim()).filter(e => e);
              return emails.map(e => ({ email: e, name: c.name }));
            }),
            subject: emailSubject.trim(),
            message: emailMessage.trim(),
            messageHtml: getEditorHtml(),
            ccSender: ccSelf,
            cc: ccField.split(',').map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
            bcc: ['sagi@noga.com', ...bccField.split(',').map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))],
            attachments: attachments.map((a) => ({ name: a.name, content: a.content })),
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
          <Button size="sm" variant="outline" onClick={handleBatchImport} disabled={importing}>
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Importing...' : 'Import List'}
          </Button>
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
                    <span className="truncate flex-1">{customer.email}</span>
                    {customer.email.includes(',') && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 shrink-0">
                        {customer.email.split(',').filter(e => e.trim()).length}
                      </span>
                    )}
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
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com, email2@example.com" type="text" />
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
              <Label className="text-xs text-muted-foreground">CC (comma-separated)</Label>
              <Input value={ccField} onChange={(e) => setCcField(e.target.value)} placeholder="cc1@example.com, cc2@example.com" type="text" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">BCC (comma-separated)</Label>
              <Input value={bccField} onChange={(e) => setBccField(e.target.value)} placeholder="bcc@example.com" type="text" />
            </div>
            <div>
              <Label>Template</Label>
              <Select
                value=""
                onValueChange={(id) => {
                  const tpl = allTemplates.find((t) => t.id === id);
                  if (tpl) {
                    setEmailSubject(tpl.subject);
                    setEmailMessage(tpl.message);
                    if (editorRef.current) {
                      editorRef.current.innerHTML = tpl.message.replace(/\n/g, '<br>');
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Load a template..." />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.length > 0 && (
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Built-in</div>
                  )}
                  {EMAIL_TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">Saved</div>
                      {customTemplates.map((tpl) => (
                        <div key={tpl.id} className="flex items-center group">
                          <SelectItem value={tpl.id} className="flex-1">
                            {tpl.name}
                          </SelectItem>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 mr-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
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
              <TooltipProvider delayDuration={300}>
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-0.5 px-2 py-1 bg-muted/50 border-b flex-wrap">
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('bold')}>
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Bold (Ctrl+B)</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('italic')}>
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Italic (Ctrl+I)</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('underline')}>
                        <Underline className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Underline (Ctrl+U)</TooltipContent></Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('insertUnorderedList')}>
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Bullet List</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('insertOrderedList')}>
                        <ListOrdered className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('undo')}>
                        <Undo className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execFormat('redo')}>
                        <Redo className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        const text = window.getSelection()?.toString();
                        if (text) {
                          await navigator.clipboard.writeText(text);
                          toast({ title: 'Copied to clipboard' });
                        }
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Copy</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          execFormat('insertText', text);
                        } catch {
                          toast({ title: 'Paste', description: 'Use Ctrl+V to paste', variant: 'destructive' });
                        }
                      }}>
                        <ClipboardPaste className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Paste</TooltipContent></Tooltip>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    className="min-h-[150px] max-h-[300px] overflow-y-auto p-3 text-sm focus:outline-none"
                    onInput={handleEditorInput}
                    data-placeholder="Write your message..."
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                </div>
              </TooltipProvider>
              <p className="text-xs text-muted-foreground mt-1">{emailMessage.length}/5000</p>
            </div>
            <div>
              <Label className="text-sm">Attachments</Label>
              <div className="mt-1 space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <Paperclip className="w-3 h-3 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{att.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(att.size / 1024).toFixed(0)}KB
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAttachment(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
                  <Paperclip className="w-4 h-4" />
                  Add file
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
                <p className="text-xs text-muted-foreground">Max 5MB per file, 10MB total</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cc-self"
                checked={ccSelf}
                onChange={(e) => setCcSelf(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="cc-self" className="text-sm font-normal cursor-pointer">
                CC myself ({user?.email})
              </Label>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => setSaveTemplateOpen(true)}
              disabled={!emailSubject.trim() || !emailMessage.trim()}
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              Save Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!emailSubject.trim() || !emailMessage.trim()}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
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

      {/* Email Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div
              dangerouslySetInnerHTML={{
                __html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #ff9004; margin-bottom: 20px;">
                      <img src="/logo.png" alt="Noga Engineering & Technology" style="max-height: 60px; max-width: 200px; background-color: #ffffff; padding: 4px; border-radius: 4px;" />
                    </div>
                    <h2 style="color: #ff9004;">${emailSubject}</h2>
                    <div style="line-height: 1.6; color: #333;">${getEditorHtml()}</div>
                    <p style="margin-top: 30px; color: #ff9004;">Best regards,<br><strong>Noga MT Team</strong></p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #999;">
                      Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel<br>
                      <a href="https://www.nogamt.com" style="color: #ff9004;">www.nogamt.com</a>
                    </p>
                    <p style="font-size: 11px; color: #bbb; margin-top: 20px;">
                      <a href="#" style="color: #bbb;">Unsubscribe</a> from future emails.
                    </p>
                  </div>
                `,
              }}
            />
          </div>
          {attachments.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Attachments:</span> {attachments.map(a => a.name).join(', ')}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Save Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly Update"
                maxLength={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The current subject and message will be saved. You can load this template from the dropdown next time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
