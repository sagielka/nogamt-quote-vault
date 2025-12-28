import { LineItem } from '@/types/quotation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/quotation-utils';

interface LineItemRowProps {
  item: LineItem;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export const LineItemRow = ({ item, onUpdate, onRemove, canRemove }: LineItemRowProps) => {
  const lineTotal = item.quantity * item.unitPrice;

  return (
    <div className="grid grid-cols-12 gap-3 items-center animate-fade-in">
      <div className="col-span-5">
        <Input
          placeholder="Item description"
          value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })}
          className="input-focus"
        />
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          min="1"
          placeholder="Qty"
          value={item.quantity || ''}
          onChange={(e) => onUpdate(item.id, { quantity: parseInt(e.target.value) || 0 })}
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
          onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
          className="input-focus text-right"
        />
      </div>
      <div className="col-span-2 text-right font-medium text-foreground">
        {formatCurrency(lineTotal)}
      </div>
      <div className="col-span-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          disabled={!canRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
