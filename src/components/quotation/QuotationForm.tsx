import { useState, useEffect, useRef } from 'react';
import { LineItem, QuotationFormData, Currency, CURRENCIES } from '@/types/quotation';
import { searchProducts, ProductItem } from '@/data/product-catalog';
import { createEmptyLineItem, calculateSubtotal, calculateTax, calculateTotal, formatCurrency, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { quotationSchema } from '@/lib/validation-schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineItemWithSku } from './LineItemWithSku';
import { Plus, FileText, Users, Zap, CircuitBoard, Database, Terminal, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface QuotationFormProps {
  onSubmit: (data: QuotationFormData) => void;
  initialData?: Partial<QuotationFormData>;
  isEditing?: boolean;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

export const QuotationForm = ({ onSubmit, initialData, isEditing }: QuotationFormProps) => {
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

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

  const saveCustomerToDatabase = async () => {
    if (!clientName || !clientEmail || !user) return;

    // Check if customer already exists for this user
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', clientEmail)
      .eq('user_id', user.id)
      .single();

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

    onSubmit({
      clientName: validationResult.data.clientName,
      clientEmail: validationResult.data.clientEmail,
      clientAddress: validationResult.data.clientAddress || '',
      items,
      taxRate: validationResult.data.taxRate,
      discountType: validationResult.data.discountType,
      discountValue: validationResult.data.discountValue,
      notes: validationResult.data.notes || '',
      validUntil: validationResult.data.validUntil,
      status: 'draft',
      currency: currency,
      attachments: [],
    });
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-primary/80 uppercase text-xs tracking-wider">
                <Database className="w-3 h-3" />
                Select Existing Customer
              </Label>
              <Select onValueChange={handleSelectCustomer}>
                <SelectTrigger className="input-focus bg-secondary/50 border-primary/20 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Choose a saved customer..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/20">
                  {customers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-primary/10 rounded-sm group">
                      <SelectItem value={customer.id} className="flex-1 p-0 focus:bg-transparent">
                        {customer.name} ({customer.email})
                      </SelectItem>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCustomer(customer);
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
                            handleDeleteCustomer(customer.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="clientEmail" className="text-muted-foreground uppercase text-xs tracking-wider">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                className="input-focus bg-secondary/50 border-primary/20 placeholder:text-muted-foreground/50"
              />
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

          <div className="flex items-center gap-2 pt-2">
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
        </CardContent>
      </Card>

      {/* Currency Selection */}
      <Card className="card-elevated group hover:shadow-glow transition-shadow duration-500">
        <CardHeader className="border-b border-primary/10">
          <CardTitle className="heading-display text-lg flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </span>
            <span className="text-accent">Currency</span>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/50 to-transparent ml-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
            <SelectTrigger className="w-full md:w-64 input-focus bg-secondary/50 border-accent/20 hover:border-accent/40 transition-colors">
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
        <CardContent className="space-y-4 pt-6">
          {/* Header */}
          <div className="hidden md:grid md:grid-cols-11 gap-3 text-xs font-medium text-primary uppercase tracking-wider border-b border-primary/20 pb-3 px-2">
            <div className="col-span-2">SKU</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-center">Lead Time</div>
            <div className="col-span-1 text-center">MOQ</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-1 text-center">Disc %</div>
            <div className="col-span-1 text-right">Total</div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((item, index) => (
              <LineItemWithSku
                key={item.id}
                item={item}
                index={index}
                currency={currency}
                onUpdate={handleUpdateItem}
                onRemove={handleRemoveItem}
                canRemove={items.length > 1}
              />
            ))}
          </div>

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
    </form>
  );
};
