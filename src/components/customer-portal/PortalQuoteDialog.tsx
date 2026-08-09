import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateDiscount,
  calculateTotal,
  formatDate,
} from '@/lib/quotation-utils';

interface Props {
  quote: any | null;
  onOpenChange: (open: boolean) => void;
}

export const PortalQuoteDialog = ({ quote, onOpenChange }: Props) => {
  if (!quote) return null;

  const items: any[] = Array.isArray(quote.items) ? quote.items : [];
  const ccy = quote.currency || 'USD';
  const fmt = (v: number) =>
    `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(
    subtotal,
    (quote.discount_type as any) || 'percentage',
    quote.discount_value || 0
  );
  const tax = calculateTax(subtotal - discount, quote.tax_rate || 0);
  const total = calculateTotal(
    items,
    quote.tax_rate || 0,
    (quote.discount_type as any) || 'percentage',
    quote.discount_value || 0
  );

  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{quote.quote_number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p>{formatDate(new Date(quote.created_at))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valid until</p>
            <p>{formatDate(new Date(quote.valid_until))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="capitalize">{quote.status || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Currency</p>
            <p>{ccy}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Unit price</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs">{it.sku || '—'}</td>
                  <td className="px-3 py-2">
                    {it.description}
                    {it.notes && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{it.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">{it.quantity}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(it.unitPrice) || 0)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(calculateLineTotal(it))}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No line items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{fmt(discount)}</span>
              </div>
            )}
            {(quote.tax_rate || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({quote.tax_rate}%)</span>
                <span>{fmt(tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
