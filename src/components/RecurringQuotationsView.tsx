import { useState } from 'react';
import { useRecurringQuotations } from '@/hooks/useRecurringQuotations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { RepeatIcon, Trash2, Calendar, User, Clock, Plus, X } from 'lucide-react';
import { formatCurrency, calculateTotal, createEmptyLineItem } from '@/lib/quotation-utils';
import { useToast } from '@/hooks/use-toast';
import { LineItem, Currency, CURRENCIES } from '@/types/quotation';

interface RecurringQuotationsViewProps {
  onBack: () => void;
}

export const RecurringQuotationsView = ({ onBack }: RecurringQuotationsViewProps) => {
  const { recurring, loading, createRecurring, toggleActive, deleteRecurring } = useRecurringQuotations();
  const { toast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [nextRunAt, setNextRunAt] = useState('');
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);

  const resetForm = () => {
    setClientName('');
    setClientEmail('');
    setFrequency('monthly');
    setCurrency('USD');
    setNextRunAt('');
    setItems([createEmptyLineItem()]);
    setShowCreate(false);
  };

  const handleCreate = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !nextRunAt) {
      toast({ title: 'Missing fields', description: 'Please fill in client name, email, and next run date.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const result = await createRecurring({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      templateItems: items,
      currency,
      taxRate: 0,
      frequency,
      nextRunAt: new Date(nextRunAt),
    });
    setCreating(false);
    if (result) {
      toast({ title: 'Schedule Created', description: `Recurring ${frequency} quote for ${clientName} created.` });
      resetForm();
    } else {
      toast({ title: 'Error', description: 'Failed to create schedule.', variant: 'destructive' });
    }
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleActive(id, isActive);
    toast({
      title: isActive ? 'Schedule Activated' : 'Schedule Paused',
      description: isActive ? 'Recurring quotes will be generated on schedule.' : 'Quote generation paused.',
    });
  };

  const handleDelete = async (id: string) => {
    await deleteRecurring(id);
    toast({ title: 'Deleted', description: 'Recurring schedule removed.' });
    setDeleteConfirmId(null);
  };

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      default: return freq;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
          <RepeatIcon className="w-6 h-6 text-primary" />
          <h2 className="heading-display text-2xl text-foreground">Recurring Quotations</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {recurring.length} schedule{recurring.length !== 1 ? 's' : ''}
          </p>
          {!showCreate && (
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              New Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="card-elevated border-primary/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">New Recurring Schedule</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                placeholder="Client Name *"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <Input
                placeholder="Client Email *"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={nextRunAt}
                onChange={(e) => setNextRunAt(e.target.value)}
                placeholder="Next run date *"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.symbol} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Simple line items */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Template Items</p>
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-[1fr_2fr_80px_80px_auto] gap-2 items-center">
                  <Input
                    placeholder="SKU"
                    value={item.sku}
                    onChange={(e) => updateItem(idx, { sku: e.target.value })}
                    className="font-mono text-sm"
                  />
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    min={1}
                    value={item.moq || ''}
                    onChange={(e) => updateItem(idx, { moq: parseInt(e.target.value) || 1 })}
                    className="text-center"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    min={0}
                    step={0.01}
                    value={item.unitPrice || ''}
                    onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="text-right font-mono"
                  />
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setItems(prev => [...prev, createEmptyLineItem()])}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Schedule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {recurring.length === 0 && !showCreate ? (
        <div className="text-center py-12">
          <RepeatIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No recurring schedules</h3>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Create a recurring schedule to auto-generate quotes on a regular basis.
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Schedule
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {recurring.map((item) => {
            const total = calculateTotal(
              item.template_items || [],
              item.tax_rate,
              (item.discount_type as any) || 'percentage',
              item.discount_value || 0
            );

            return (
              <Card key={item.id} className="card-elevated">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm truncate">
                            {item.client_name}
                          </h3>
                          <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                            {item.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatFrequency(item.frequency)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.client_email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Next: {formatDate(item.next_run_at)}
                          </span>
                          {item.last_run_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last: {formatDate(item.last_run_at)}
                            </span>
                          )}
                          <span>{(item.template_items || []).length} items</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-semibold text-primary whitespace-nowrap">
                        {formatCurrency(total, item.currency as any)}
                      </span>
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => handleToggle(item.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recurring quotation schedule. Generated quotes will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
