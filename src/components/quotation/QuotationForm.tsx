import { useState, useEffect } from 'react';
import { LineItem, QuotationFormData, Currency, CURRENCIES } from '@/types/quotation';
import { createEmptyLineItem, calculateSubtotal, calculateTax, calculateTotal, formatCurrency } from '@/lib/quotation-utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineItemRow } from './LineItemRow';
import { Plus, FileText, Users } from 'lucide-react';
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
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [validUntil, setValidUntil] = useState<Date>(
    initialData?.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [currency, setCurrency] = useState<Currency>(initialData?.currency || 'USD');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saveCustomer, setSaveCustomer] = useState(true);
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
      notes,
      validUntil,
      status: 'draft',
      currency,
    });
  };

  const subtotal = calculateSubtotal(items);
  const tax = calculateTax(subtotal, taxRate);
  const total = calculateTotal(items, taxRate);

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
          <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground border-b pb-2">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-center">Quantity</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                onUpdate={handleUpdateItem}
                onRemove={handleRemoveItem}
                canRemove={items.length > 1}
              />
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
