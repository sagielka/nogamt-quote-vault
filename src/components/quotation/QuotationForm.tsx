import { useState, useEffect, useRef, useCallback } from 'react';
import { LineItem, QuotationFormData, Currency, CURRENCIES } from '@/types/quotation';
import { searchProducts, ProductItem, PriceList, PRICE_LISTS, getPriceListBaseCurrency, convertPrice, getProductPrice } from '@/data/product-catalog';
import { createEmptyLineItem, calculateSubtotal, calculateTax, calculateTotal, formatCurrency, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { quotationSchema } from '@/lib/validation-schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineItemWithSku } from './LineItemWithSku';
import { Plus, FileText, Users, Zap, CircuitBoard, Database, Terminal, Pencil, Trash2, ChevronsUpDown, Search, Paperclip, Upload, ExternalLink, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface SimilarQuotation {
  quoteNumber: string;
  clientName: string;
  createdAt: Date;
  matchingSkus: string[];
}

interface QuotationFormProps {
  onSubmit: (data: QuotationFormData) => void;
  initialData?: Partial<QuotationFormData> & { id?: string };
  isEditing?: boolean;
  existingQuotations?: Array<{ id: string; clientName: string; clientEmail: string; quoteNumber: string; items: LineItem[]; createdAt: Date }>;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

const CustomerSearchSelect = ({
  customers,
  onSelect,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  onSelect: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-primary/80 uppercase text-xs tracking-wider">
        <Database className="w-3 h-3" />
        Select Existing Customer
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between input-focus bg-secondary/50 border-primary/20 hover:border-primary/40 transition-colors font-normal text-muted-foreground"
          >
            Choose a saved customer...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border-primary/20" align="start">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No customers found</div>
            ) : (
              filtered.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-primary/10 cursor-pointer group transition-colors"
                  onClick={() => {
                    onSelect(customer.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{customer.name}</span>
                    <span className="text-sm text-muted-foreground ml-1.5">({customer.email})</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(customer);
                        setOpen(false);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(customer.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const QuotationForm = ({ onSubmit, initialData, isEditing, existingQuotations = [] }: QuotationFormProps) => {
  const [clientName, setClientName] = useState(initialData?.clientName || '');
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState(initialData?.quoteNumber || '');
  const [items, setItems] = useState<LineItem[]>(
    initialData?.items || [createEmptyLineItem()]
  );
  const [taxRate, setTaxRate] = useState(initialData?.taxRate || 0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(initialData?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(initialData?.discountValue || 0);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [validUntil, setValidUntil] = useState<Date>(
    initialData?.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [currency, setCurrency] = useState<Currency>(initialData?.currency || 'USD');
  const [previousCurrency, setPreviousCurrency] = useState<Currency>(initialData?.currency || 'USD');
  const [priceList, setPriceList] = useState<PriceList>('DOLLAR');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const emailFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingEmail, setIsDraggingEmail] = useState(false);
  const emailDragCounterRef = useRef(0);
  const [emailAttachments, setEmailAttachments] = useState<any[]>([]);
  const [pendingEmailFiles, setPendingEmailFiles] = useState<File[]>([]);
  const [uploadingEmail, setUploadingEmail] = useState(false);
  const [similarQuotes, setSimilarQuotes] = useState<SimilarQuotation[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<QuotationFormData | null>(null);
  const quotationId = initialData?.id;

  useEffect(() => {
    fetchCustomers().then(() => {
      // If editing, try to match the initial customer
      if (initialData?.clientEmail && initialData?.clientName) {
        supabase
          .from('customers')
          .select('id')
          .eq('email', initialData.clientEmail)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setSelectedCustomerId(data.id);
          });
      }
    });
  }, []);

  // Email attachments
  const refreshEmailAttachments = useCallback(async () => {
    if (!quotationId) return;
    const { data } = await supabase
      .from('quotation_email_attachments')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('uploaded_at', { ascending: false });
    if (data) setEmailAttachments(data);
  }, [quotationId]);

  useEffect(() => {
    if (isEditing && quotationId) {
      refreshEmailAttachments();
    }
  }, [isEditing, quotationId, refreshEmailAttachments]);

  const handleUploadEmailFile = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['eml', 'msg'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Only .eml and .msg files are supported.', variant: 'destructive' });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 20MB limit.`, variant: 'destructive' });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // If no quotation ID yet (new quote), queue files locally
    if (!quotationId) {
      setPendingEmailFiles(prev => [...prev, ...validFiles]);
      toast({ title: 'Files Queued', description: `${validFiles.length} file(s) will be uploaded when the quotation is saved.` });
      if (emailFileInputRef.current) emailFileInputRef.current.value = '';
      return;
    }

    // Existing quotation: upload immediately
    setUploadingEmail(true);
    try {
      for (const file of validFiles) {
        const filePath = `${quotationId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('email-attachments').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from('quotation_email_attachments').insert({
          quotation_id: quotationId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });
        if (dbError) throw dbError;
      }
      toast({ title: 'Email(s) Attached', description: `Successfully attached ${validFiles.length} file(s).` });
      await refreshEmailAttachments();
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload.', variant: 'destructive' });
    } finally {
      setUploadingEmail(false);
      if (emailFileInputRef.current) emailFileInputRef.current.value = '';
    }
  };

  const handleDeleteEmailAttachment = async (attachment: any) => {
    try {
      await supabase.storage.from('email-attachments').remove([attachment.file_path]);
      await supabase.from('quotation_email_attachments').delete().eq('id', attachment.id);
      toast({ title: 'Deleted', description: 'Email attachment removed.' });
      await refreshEmailAttachments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadEmailAttachment = async (attachment: any) => {
    const { data } = await supabase.storage.from('email-attachments').createSignedUrl(attachment.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };


  const handlePriceListChange = (newPriceList: PriceList) => {
    const baseCurrency = getPriceListBaseCurrency(newPriceList);
    
    // Update all item prices from the new price list
    const updatedItems = items.map(item => {
      if (item.sku) {
        const newPrice = getProductPrice(item.sku, newPriceList, item.description);
        if (newPrice !== null) {
          // Convert from price list base currency to display currency
          const convertedPrice = convertPrice(newPrice, baseCurrency, currency);
          return { ...item, unitPrice: Math.round(convertedPrice * 100) / 100 };
        }
      }
      return item;
    });

    setItems(updatedItems);
    setPriceList(newPriceList);
  };

  // Handle currency conversion when display currency changes
  const handleCurrencyChange = (newCurrency: Currency) => {
    if (newCurrency === previousCurrency) {
      setCurrency(newCurrency);
      return;
    }

    // Get base currency of current price list to convert properly
    const baseCurrency = getPriceListBaseCurrency(priceList);

    // Re-fetch prices from price list and convert to new currency
    const convertedItems = items.map(item => {
      if (item.sku) {
        const basePrice = getProductPrice(item.sku, priceList, item.description);
        if (basePrice !== null) {
          const convertedPrice = convertPrice(basePrice, baseCurrency, newCurrency);
          return { ...item, unitPrice: Math.round(convertedPrice * 100) / 100 };
        }
      }
      // Fallback: convert existing price if no SKU match
      if (item.unitPrice > 0) {
        const convertedPrice = convertPrice(item.unitPrice, previousCurrency, newCurrency);
        return { ...item, unitPrice: Math.round(convertedPrice * 100) / 100 };
      }
      return item;
    });

    setItems(convertedItems);
    setPreviousCurrency(newCurrency);
    setCurrency(newCurrency);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (data && !error) {
      setCustomers(data);
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setClientName(customer.name);
      setClientEmail(customer.email);
      setClientAddress(customer.address || '');
      setSelectedCustomerId(customer.id);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditAddress(customer.address || '');
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;

    const { error } = await supabase
      .from('customers')
      .update({ 
        name: editName, 
        email: editEmail, 
        address: editAddress || null 
      })
      .eq('id', editingCustomer.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update customer.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Customer Updated',
        description: 'Customer details have been updated.',
      });
      fetchCustomers();
      setEditingCustomer(null);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete customer.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Customer Deleted',
        description: 'Customer has been removed.',
      });
      fetchCustomers();
    }
  };

  const handleAddItem = () => {
    setItems([...items, createEmptyLineItem()]);
  };

  const handleUpdateItem = (id: string, updates: Partial<LineItem>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const handleDuplicateItem = (id: string) => {
    const source = items.find((item) => item.id === id);
    if (!source) return;
    const newItem: LineItem = { ...source, id: crypto.randomUUID() };
    const idx = items.findIndex((item) => item.id === id);
    const updated = [...items];
    updated.splice(idx + 1, 0, newItem);
    setItems(updated);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveCustomerToDatabase = async () => {
    if (!clientName || !clientEmail || !user) return;

    // First try to find by tracked ID, then fall back to email match
    let existingCustomer: { id: string } | null = null;
    
    if (selectedCustomerId) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('id', selectedCustomerId)
        .single();
      existingCustomer = data;
    }
    
    if (!existingCustomer) {
      // Fall back to matching by name (case-insensitive) for the same user
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', clientName);
      existingCustomer = data && data.length > 0 ? data[0] : null;
    }
    
    if (!existingCustomer) {
      // Fall back to email match
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('email', clientEmail)
        .eq('user_id', user.id)
        .single();
      existingCustomer = data;
    }

    if (existingCustomer) {
      // Update existing customer
      const { error } = await supabase
        .from('customers')
        .update({ 
          name: clientName, 
          email: clientEmail, 
          address: clientAddress || null 
        })
        .eq('id', existingCustomer.id);

      if (error) {
        console.error('Error updating customer:', error);
      } else {
        toast({
          title: 'Customer Updated',
          description: 'Customer details updated.',
        });
        fetchCustomers();
      }
    } else {
      // Insert new customer
      const { error } = await supabase
        .from('customers')
        .insert({ 
          name: clientName, 
          email: clientEmail, 
          address: clientAddress || null,
          user_id: user.id
        });

      if (error) {
        console.error('Error saving customer:', error);
      } else {
        toast({
          title: 'Customer Saved',
          description: 'Customer details saved for future quotations.',
        });
        fetchCustomers();
      }
    }
  };

  const findSimilarQuotations = useCallback((submittedClientName: string, submittedClientEmail: string, submittedItems: LineItem[]): SimilarQuotation[] => {
    if (isEditing || existingQuotations.length === 0) return [];
    
    const normalizedName = submittedClientName.trim().toLowerCase();
    const normalizedEmail = submittedClientEmail.trim().toLowerCase();
    const submittedSkus = submittedItems.map(i => i.sku.trim().toLowerCase()).filter(Boolean);
    
    return existingQuotations
      .filter(q => {
        const qName = q.clientName.trim().toLowerCase();
        const qEmail = q.clientEmail.trim().toLowerCase();
        // Same client by name OR email
        if (qName !== normalizedName && qEmail !== normalizedEmail) return false;
        // Check for overlapping SKUs
        const qSkus = q.items.map(i => i.sku.trim().toLowerCase()).filter(Boolean);
        const overlap = submittedSkus.filter(s => qSkus.includes(s));
        return overlap.length > 0;
      })
      .map(q => {
        const qSkus = q.items.map(i => i.sku.trim().toLowerCase()).filter(Boolean);
        const matchingSkus = submittedSkus.filter(s => qSkus.includes(s));
        return {
          quoteNumber: q.quoteNumber,
          clientName: q.clientName,
          createdAt: q.createdAt,
          matchingSkus,
        };
      });
  }, [isEditing, existingQuotations]);

  const buildSubmitData = useCallback((validationResult: any): QuotationFormData => ({
    clientName: validationResult.data.clientName,
    clientEmail: validationResult.data.clientEmail,
    clientAddress: validationResult.data.clientAddress || '',
    items,
    taxRate: validationResult.data.taxRate,
    discountType: validationResult.data.discountType,
    discountValue: validationResult.data.discountValue,
    notes: validationResult.data.notes || '',
    validUntil: validationResult.data.validUntil,
    status: isEditing ? ('draft' as const) : ('sent' as const),
    currency: currency,
    attachments: [],
    orderedItems: null,
    quoteNumber: isEditing && quoteNumber ? quoteNumber : undefined,
    pendingEmailFiles: pendingEmailFiles.length > 0 ? pendingEmailFiles : undefined,
  }), [items, currency, isEditing, quoteNumber, pendingEmailFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data using Zod schema
    const formData = {
      clientName,
      clientEmail,
      clientAddress,
      items: items.map(item => ({
        ...item,
        discountPercent: item.discountPercent || 0,
      })),
      taxRate,
      discountType,
      discountValue,
      notes,
      currency,
      validUntil,
    };

    const validationResult = quotationSchema.safeParse(formData);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: 'Validation Error',
        description: firstError.message,
        variant: 'destructive',
      });
      return;
    }
    
    if (saveCustomer) {
      await saveCustomerToDatabase();
    }

    const submitData = buildSubmitData(validationResult);

    // Check for similar quotations (only on create, not edit)
    if (!isEditing) {
      const similar = findSimilarQuotations(clientName, clientEmail, items);
      if (similar.length > 0) {
        setSimilarQuotes(similar);
        setPendingSubmitData(submitData);
        setShowDuplicateDialog(true);
        return;
      }
    }

    onSubmit(submitData);
  };

  const handleConfirmDuplicate = () => {
    if (pendingSubmitData) {
      onSubmit(pendingSubmitData);
      setShowDuplicateDialog(false);
      setPendingSubmitData(null);
      setSimilarQuotes([]);
    }
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false);
    setPendingSubmitData(null);
    setSimilarQuotes([]);
  };

  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountType, discountValue);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, taxRate);
  const total = calculateTotal(items, taxRate, discountType, discountValue);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      {/* Client Details */}
      <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
        <CardHeader className="border-b border-primary/10">
          <CardTitle className="heading-display text-lg flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center animate-glow-pulse">
              <Users className="w-5 h-5 text-primary" />
            </span>
            <span className="glow-text text-primary">Client Details</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent ml-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Existing Customers Selector */}
          {customers.length > 0 && (
            <CustomerSearchSelect
              customers={customers}
              onSelect={handleSelectCustomer}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
            />
          )}

          {/* Quote Number (editable when editing) */}
          {isEditing && quoteNumber && (
            <div className="space-y-2">
              <Label htmlFor="quoteNumber" className="text-muted-foreground uppercase text-xs tracking-wider">Quote Number</Label>
              <Input
                id="quoteNumber"
                placeholder="Quote number"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                className="input-focus bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50 font-mono"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-muted-foreground uppercase text-xs tracking-wider">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Company or client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="input-focus bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail" className="text-muted-foreground uppercase text-xs tracking-wider">Email(s)</Label>
              <Input
                id="clientEmail"
                placeholder="client@example.com, another@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                className="input-focus bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
              {clientEmail && (() => {
                const invalid = clientEmail.split(',').map(e => e.trim()).filter(e => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                return invalid.length > 0 ? (
                  <p className="text-xs text-destructive">Invalid: {invalid.join(', ')}</p>
                ) : null;
              })()}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clientAddress" className="text-muted-foreground uppercase text-xs tracking-wider">Address</Label>
              <Textarea
                id="clientAddress"
                placeholder="Client address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
                className="input-focus resize-none bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveCustomer"
                checked={saveCustomer}
                onChange={(e) => setSaveCustomer(e.target.checked)}
                className="rounded border-primary/30 bg-secondary/50 text-primary focus:ring-primary/30"
              />
              <Label htmlFor="saveCustomer" className="text-sm text-muted-foreground cursor-pointer">
                Save customer for future quotations
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!clientName || !clientEmail || (() => {
                const emails = clientEmail.split(',').map(e => e.trim()).filter(Boolean);
                return emails.length === 0 || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
              })()}
              onClick={async () => {
                await saveCustomerToDatabase();
              }}
            >
              Save Customer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price List & Currency Selection */}
      <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
        <CardHeader className="border-b border-primary/10">
          <CardTitle className="heading-display text-lg flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </span>
            <span className="text-accent">Price List & Currency</span>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/50 to-transparent ml-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground uppercase text-xs tracking-wider">Price List (auto-fill prices)</Label>
              <Select value={priceList} onValueChange={(value) => handlePriceListChange(value as PriceList)}>
                <SelectTrigger className="w-full input-focus bg-secondary/50 border-accent/20 hover:border-accent/40 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-accent/20">
                  {PRICE_LISTS.map((pl) => (
                    <SelectItem key={pl.value} value={pl.value} className="hover:bg-accent/10">
                      {pl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground uppercase text-xs tracking-wider">Display Currency</Label>
              <Select value={currency} onValueChange={(value) => handleCurrencyChange(value as Currency)}>
                <SelectTrigger className="w-full input-focus bg-secondary/50 border-accent/20 hover:border-accent/40 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-accent/20">
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value} className="hover:bg-accent/10">
                      {curr.symbol} {curr.label} ({curr.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
        <CardHeader className="border-b border-primary/10">
          <CardTitle className="heading-display text-lg flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <CircuitBoard className="w-5 h-5 text-primary" />
            </span>
            <span className="glow-text text-primary">Line Items</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent ml-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 overflow-x-auto">
          {/* Header */}
          <div className="min-w-[1050px]">
            <div className="hidden md:grid <div className="hidden md:grid md:grid-cols-[28px_130px_1fr_45px_45px_65px_85px_45px_55px_85px_88px] gap-1.5 text-xs font-medium text-primary uppercase tracking-wider border-b border-primary/20 pb-3 mx-3 mt-1 items-end"> gap-1.5 text-xs font-medium text-primary uppercase tracking-wider border-b border-primary/20 pb-3 mx-3 mt-1 items-end">
              <div></div>
              <div className="text-center">SKU</div>
              <div className="text-center">Description</div>
              <div className="text-center">LT</div>
              <div className="text-center">MOQ</div>
              <div className="text-center">Cost</div>
              <div className="text-center">Price ({currency})</div>
              <div className="text-center">Disc%</div>
              <div className="text-center">Margin</div>
              <div className="text-right">Total</div>
              <div className="text-center">Actions</div>
            </div>
          </div>

          {/* Items */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {items.map((item, index) => (
                  <LineItemWithSku
                    key={item.id}
                    item={item}
                    index={index}
                    currency={currency}
                    priceList={priceList}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    onDuplicate={handleDuplicateItem}
                    canRemove={items.length > 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button 
            type="button" 
            variant="outline" 
            onClick={handleAddItem} 
            className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary group"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            Add Line Item
          </Button>

          {/* Totals */}
          <div className="border-t border-primary/20 pt-4 space-y-3 bg-secondary/20 -mx-6 px-6 pb-2 rounded-b-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground uppercase tracking-wider text-xs">Subtotal</span>
              <span className="font-mono font-medium">{formatCurrency(subtotal, currency)}</span>
            </div>
            
            {/* Discount */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-wider text-xs">Discount</span>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}>
                  <SelectTrigger className="w-24 h-8 bg-background/50 border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-primary/20">
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-center input-focus bg-background/50 border-primary/20"
                />
              </div>
              <span className="font-mono font-medium text-destructive">-{formatCurrency(discount, currency)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-wider text-xs">Tax Rate (%)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate || ''}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-center input-focus bg-background/50 border-primary/20"
                />
              </div>
              <span className="font-mono font-medium">{formatCurrency(tax, currency)}</span>
            </div>
            <div className="flex justify-between text-xl font-semibold pt-3 border-t border-primary/30">
              <span className="uppercase tracking-wider">Total</span>
              <span className="text-primary glow-text font-mono">{formatCurrency(total, currency)}</span>
            </div>
            
            {/* Profit Margin Summary */}
            {(() => {
              const totalCost = items.reduce((sum, item) => sum + (item.costPrice || 0) * item.moq, 0);
              const totalRevenue = subtotal;
              const totalProfit = totalRevenue - totalCost;
              const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
              const hasCostData = items.some(item => item.costPrice && item.costPrice > 0);
              
              if (!hasCostData) return null;
              
              return (
                <div className="pt-3 border-t border-primary/20 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Total Cost</span>
                    <span className="font-mono font-medium">{formatCurrency(totalCost, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Profit</span>
                    <span className={`font-mono font-semibold ${totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {formatCurrency(totalProfit, currency)} ({marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
        <CardHeader className="border-b border-primary/10">
          <CardTitle className="heading-display text-lg flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-primary" />
            </span>
            <span className="glow-text text-primary">Additional Details</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent ml-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="validUntil" className="text-muted-foreground uppercase text-xs tracking-wider">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil.toISOString().split('T')[0]}
              onChange={(e) => setValidUntil(new Date(e.target.value))}
              className="input-focus bg-secondary/50 border-primary/20 w-full md:w-64"
            />
          </div>
          
          {/* Standard Terms Checkboxes */}
          <div className="space-y-3">
            <Label className="text-muted-foreground uppercase text-xs tracking-wider">Standard Terms</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notes.includes("Payment Terms: Net prices")}
                  onChange={(e) => {
                    const term = "Payment Terms: Net prices";
                    if (e.target.checked) {
                      setNotes(notes ? `${notes}\n· ${term}.` : `· ${term}.`);
                    } else {
                      setNotes(notes.replace(`· ${term}.`, "").replace(/\n+/g, "\n").trim());
                    }
                  }}
                  className="rounded border-primary/30 bg-secondary/50 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Payment Terms: Net prices</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notes.includes("Payment Terms: Net 30 EOM")}
                  onChange={(e) => {
                    const term = "Payment Terms: Net 30 EOM";
                    if (e.target.checked) {
                      setNotes(notes ? `${notes}\n· ${term}.` : `· ${term}.`);
                    } else {
                      setNotes(notes.replace(`· ${term}.`, "").replace(/\n+/g, "\n").trim());
                    }
                  }}
                  className="rounded border-primary/30 bg-secondary/50 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Payment Terms: Net 30 EOM</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notes.includes("Delivery Terms: Shipment via air freight")}
                  onChange={(e) => {
                    const term = "Delivery Terms: Shipment via air freight (unless otherwise agreed)";
                    if (e.target.checked) {
                      setNotes(notes ? `${notes}\n· ${term}.` : `· ${term}.`);
                    } else {
                      setNotes(notes.replace(`· ${term}.`, "").replace(/\n+/g, "\n").trim());
                    }
                  }}
                  className="rounded border-primary/30 bg-secondary/50 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Delivery: Air freight (unless otherwise agreed)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notes.includes("Shipment Costs: FOB")}
                  onChange={(e) => {
                    const term = "Shipment Costs: FOB";
                    if (e.target.checked) {
                      setNotes(notes ? `${notes}\n· ${term}.` : `· ${term}.`);
                    } else {
                      setNotes(notes.replace(`· ${term}.`, "").replace(/\n+/g, "\n").trim());
                    }
                  }}
                  className="rounded border-primary/30 bg-secondary/50 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Shipment Costs: FOB</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-muted-foreground uppercase text-xs tracking-wider">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or terms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-focus resize-none bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Attachments */}
      {(isEditing && quotationId) || !isEditing ? (
        <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="heading-display text-lg flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Paperclip className="w-5 h-5 text-primary" />
              </span>
              <span className="glow-text text-primary">Email Attachments</span>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent ml-4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDraggingEmail
                  ? 'border-primary bg-primary/10'
                  : 'border-primary/20 hover:border-primary/40'
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                emailDragCounterRef.current++;
                setIsDraggingEmail(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                emailDragCounterRef.current--;
                if (emailDragCounterRef.current === 0) setIsDraggingEmail(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                emailDragCounterRef.current = 0;
                setIsDraggingEmail(false);
                handleUploadEmailFile(e.dataTransfer.files);
              }}
            >
              {isDraggingEmail && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-primary animate-bounce" />
                    <span className="text-sm font-medium text-primary">Drop email files here</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop .eml or .msg files here, or
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingEmail}
                  onClick={() => emailFileInputRef.current?.click()}
                  className="border-primary/30 hover:border-primary/50"
                >
                  {uploadingEmail ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Paperclip className="w-4 h-4 mr-2" /> Browse Files</>
                  )}
                </Button>
                <input
                  ref={emailFileInputRef}
                  type="file"
                  accept=".eml,.msg"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadEmailFile(e.target.files)}
                />
              </div>
            </div>

            {/* Show uploaded attachments (editing mode) */}
            {emailAttachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {emailAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/50 border border-primary/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{att.file_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(att.file_size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownloadEmailAttachment(att)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteEmailAttachment(att)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Show pending files (new quote mode) */}
            {pendingEmailFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">Pending upload (will be saved with quotation):</p>
                {pendingEmailFiles.map((file, idx) => (
                  <div
                    key={`pending-${idx}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-orange-500/10 border border-orange-500/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setPendingEmailFiles(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
      <div className="flex gap-3 justify-end">
        <Button 
          type="submit" 
          size="lg" 
          className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow hover:shadow-prominent transition-all duration-300 uppercase tracking-wider font-semibold"
        >
          <Zap className="w-4 h-4 mr-2" />
          {isEditing ? 'Update Quotation' : 'Create Quotation'}
        </Button>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="bg-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-primary">Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-focus bg-secondary/50 border-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="input-focus bg-secondary/50 border-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Textarea
                id="editAddress"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="input-focus bg-secondary/50 border-primary/20"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
            <Button onClick={handleSaveCustomer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Quotation Warning Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent className="bg-card border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Similar Quotation{similarQuotes.length > 1 ? 's' : ''} Found
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  We found {similarQuotes.length} existing quotation{similarQuotes.length > 1 ? 's' : ''} for the same customer with matching items:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {similarQuotes.map((sq, idx) => (
                    <div key={idx} className="p-3 rounded-md bg-secondary/50 border border-primary/10">
                      <div className="font-medium text-foreground">{sq.quoteNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        Created: {sq.createdAt.toLocaleDateString()}
                      </div>
                      <div className="text-xs mt-1">
                        Matching SKUs: <span className="text-primary font-medium">{sq.matchingSkus.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium">Do you still want to create this quotation?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDuplicate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>Create Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
};
