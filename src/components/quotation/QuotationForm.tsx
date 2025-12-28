import { useState, useEffect } from 'react';
import { LineItem, QuotationFormData, Currency, CURRENCIES, LineItemAttachment } from '@/types/quotation';
import { createEmptyLineItem, calculateSubtotal, calculateTax, calculateTotal, formatCurrency, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineItemRow } from './LineItemRow';
import { Plus, FileText, Users, Upload, X, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuotationFormProps {
  onSubmit: (data: QuotationFormData) => void;
  initialData?: Partial<QuotationFormData>;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

export const QuotationForm = ({ onSubmit, initialData }: QuotationFormProps) => {
  const [clientName, setClientName] = useState(initialData?.clientName || '');
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '');
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [attachments, setAttachments] = useState<LineItemAttachment[]>(initialData?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, lineItemIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quotation-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('quotation-attachments')
        .getPublicUrl(filePath);

      const newAttachment: LineItemAttachment = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileUrl: publicUrl,
        lineItemIndex,
      };

      setAttachments([...attachments, newAttachment]);
      toast({
        title: 'File Uploaded',
        description: `${file.name} attached to line ${lineItemIndex + 1}`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter(a => a.id !== attachmentId));
  };

  const saveCustomerToDatabase = async () => {
    if (!clientName || !clientEmail) return;

    const { error } = await supabase
      .from('customers')
      .upsert(
        { 
          name: clientName, 
          email: clientEmail, 
          address: clientAddress || null 
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Error saving customer:', error);
    } else {
      toast({
        title: 'Customer Saved',
        description: 'Customer details saved for future quotations.',
      });
      fetchCustomers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saveCustomer) {
      await saveCustomerToDatabase();
    }

    onSubmit({
      clientName,
      clientEmail,
      clientAddress,
      items,
      taxRate,
      discountType,
      discountValue,
      notes,
      validUntil,
      status: 'draft',
      currency,
      attachments,
    });
  };

  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountType, discountValue);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, taxRate);
  const total = calculateTotal(items, taxRate, discountType, discountValue);

  const getAttachmentsForLine = (index: number) => {
    return attachments.filter(a => a.lineItemIndex === index);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      {/* Client Details */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="heading-display text-lg flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </span>
            Client Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Customers Selector */}
          {customers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Existing Customer
              </Label>
              <Select onValueChange={handleSelectCustomer}>
                <SelectTrigger className="input-focus">
                  <SelectValue placeholder="Choose a saved customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Company or client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="input-focus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                className="input-focus"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clientAddress">Address</Label>
              <Textarea
                id="clientAddress"
                placeholder="Client address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
                className="input-focus resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="saveCustomer"
              checked={saveCustomer}
              onChange={(e) => setSaveCustomer(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="saveCustomer" className="text-sm text-muted-foreground cursor-pointer">
              Save customer for future quotations
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Currency Selection */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="heading-display text-lg">Currency</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
            <SelectTrigger className="w-full md:w-64 input-focus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.value} value={curr.value}>
                  {curr.symbol} {curr.label} ({curr.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="heading-display text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header */}
          <div className="grid grid-cols-14 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-2 text-center">Disc %</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-3 text-center">Actions</div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-14 gap-2 items-center animate-fade-in">
                  <div className="col-span-3">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                      className="input-focus"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity || ''}
                      onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                      className="input-focus text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice || ''}
                      onChange={(e) => handleUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                      className="input-focus text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      value={item.discountPercent || ''}
                      onChange={(e) => handleUpdateItem(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                      className="input-focus text-center"
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium text-foreground">
                    {formatCurrency(calculateLineTotal(item), currency)}
                  </div>
                  <div className="col-span-3 flex items-center justify-center gap-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, index)}
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4" />
                        </span>
                      </Button>
                    </label>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Attachments for this line */}
                {getAttachmentsForLine(index).map((att) => (
                  <div key={att.id} className="flex items-center gap-2 pl-4 text-sm text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">
                      {att.fileName}
                    </a>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Index {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveAttachment(att.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={handleAddItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Line Item
          </Button>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
            </div>
            
            {/* Discount */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Discount</span>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  className="w-20 h-8 text-center input-focus"
                />
              </div>
              <span className="font-medium text-destructive">-{formatCurrency(discount, currency)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tax Rate (%)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate || ''}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-center input-focus"
                />
              </div>
              <span className="font-medium">{formatCurrency(tax, currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="heading-display text-lg">Additional Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil.toISOString().split('T')[0]}
              onChange={(e) => setValidUntil(new Date(e.target.value))}
              className="input-focus"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or terms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-focus resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button type="submit" size="lg" className="min-w-[160px]">
          Create Quotation
        </Button>
      </div>
    </form>
  );
};
