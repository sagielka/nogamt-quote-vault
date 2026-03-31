import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle } from 'lucide-react';
import { LineItem, Currency } from '@/types/quotation';
import { formatCurrency } from '@/lib/quotation-utils';

interface OrderLinePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LineItem[];
  quoteNumber: string;
  currency: Currency;
  onConfirm: (selectedItemIds: string[]) => void;
}

const OrderLinePickerDialog = ({
  open,
  onOpenChange,
  items,
  quoteNumber,
  currency,
  onConfirm,
}: OrderLinePickerDialogProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(i => i.id)));

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    onOpenChange(false);
  };

  const selectedTotal = items
    .filter(i => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.unitPrice * i.moq, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Mark as Accepted — {quoteNumber}
          </DialogTitle>
          <DialogDescription>
            Select the line items that were ordered. Uncheck any items that were not included in the order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm text-primary hover:underline"
          >
            {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {items.length} selected
          </span>
        </div>

        <ScrollArea className="max-h-[350px] pr-2">
          <div className="space-y-2">
            {items.map((item) => (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedIds.has(item.id)
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-border bg-muted/30 opacity-60'
                }`}
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {item.sku || 'No SKU'}
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatCurrency(item.unitPrice * item.moq, currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.description || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {item.moq} × {formatCurrency(item.unitPrice, currency)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">
            Order Total: <span className="text-green-600">{formatCurrency(selectedTotal, currency)}</span>
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Confirm Order ({selectedIds.size} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderLinePickerDialog;
