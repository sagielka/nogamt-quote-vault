import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  onConfirm: (selectedItemIds: string[], orderedQuantities: Record<string, number>) => void;
  initialSelectedIds?: string[];
  initialQuantities?: Record<string, number> | null;
}

const OrderLinePickerDialog = ({
  open,
  onOpenChange,
  items,
  quoteNumber,
  currency,
  onConfirm,
  initialSelectedIds,
  initialQuantities,
}: OrderLinePickerDialogProps) => {
  const buildQuantities = () => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      map[i.id] = initialQuantities?.[i.id] ?? i.moq ?? 1;
    });
    return map;
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds ?? items.map(i => i.id))
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(buildQuantities);

  // Reset selection when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setSelectedIds(new Set(initialSelectedIds ?? items.map(i => i.id)));
    setQuantities(buildQuantities());
  }
  if (open !== prevOpen) setPrevOpen(open);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setQty = (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    setQuantities(prev => ({ ...prev, [id]: isNaN(parsed) || parsed < 0 ? 0 : parsed }));
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleConfirm = () => {
    const ids = Array.from(selectedIds);
    const qty: Record<string, number> = {};
    ids.forEach((id) => {
      const item = items.find(i => i.id === id);
      qty[id] = quantities[id] > 0 ? quantities[id] : (item?.moq ?? 1);
    });
    onConfirm(ids, qty);
    onOpenChange(false);
  };

  const selectedTotal = items
    .filter(i => selectedIds.has(i.id))
    .reduce((sum, i) => {
      const qty = quantities[i.id] > 0 ? quantities[i.id] : (i.moq ?? 1);
      const net = i.unitPrice * (1 - (i.discountPercent || 0) / 100);
      return sum + net * qty;
    }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Mark as Accepted — {quoteNumber}
          </DialogTitle>
          <DialogDescription>
            Select the line items that were ordered and adjust the ordered quantity if it differs from the quoted MOQ.
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
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const qty = quantities[item.id] ?? item.moq ?? 1;
              const net = item.unitPrice * (1 - (item.discountPercent || 0) / 100);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                    isSelected
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-border bg-muted/30 opacity-60'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.sku || 'No SKU'}
                      </span>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {formatCurrency(net * qty, currency)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.description || '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        MOQ: {item.moq}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor={`qty-${item.id}`}>
                        Qty ordered
                      </label>
                      <QuantityInput
                        id={`qty-${item.id}`}
                        value={qty}
                        presets={[item.moq ?? 1]}
                        disabled={!isSelected}
                        onChange={(v) => setQty(item.id, String(v))}
                        className="h-7 w-20 text-center text-xs"
                      />


                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        × {formatCurrency(net, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
