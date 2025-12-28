import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, getStatusColor } from '@/lib/quotation-utils';
import { ArrowLeft, Printer, Mail } from 'lucide-react';

interface QuotationPreviewProps {
  quotation: Quotation;
  onBack: () => void;
}

export const QuotationPreview = ({ quotation, onBack }: QuotationPreviewProps) => {
  const subtotal = calculateSubtotal(quotation.items);
  const tax = calculateTax(subtotal, quotation.taxRate);
  const total = calculateTotal(quotation.items, quotation.taxRate);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in">
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Quotations
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="accent">
            <Mail className="w-4 h-4 mr-2" />
            Send to Client
          </Button>
        </div>
      </div>

      {/* Quotation Document */}
      <Card className="card-elevated max-w-4xl mx-auto">
        <CardContent className="p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 pb-8 border-b">
            <div>
              <h1 className="heading-display text-3xl text-primary mb-2">QUOTATION</h1>
              <p className="text-lg font-medium text-foreground">{quotation.quoteNumber}</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <Badge className={getStatusColor(quotation.status)} variant="secondary">
                {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Created: {formatDate(quotation.createdAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                Valid Until: {formatDate(quotation.validUntil)}
              </p>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">BILL TO</h2>
            <p className="font-semibold text-foreground">{quotation.clientName}</p>
            <p className="text-muted-foreground">{quotation.clientEmail}</p>
            {quotation.clientAddress && (
              <p className="text-muted-foreground whitespace-pre-line">{quotation.clientAddress}</p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-20">Qty</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-28">Unit Price</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-4 text-foreground">{item.description || '—'}</td>
                    <td className="py-4 text-center text-muted-foreground">{item.quantity}</td>
                    <td className="py-4 text-right text-muted-foreground">{formatCurrency(item.unitPrice, quotation.currency)}</td>
                    <td className="py-4 text-right font-medium text-foreground">
                      {formatCurrency(item.quantity * item.unitPrice, quotation.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCurrency(subtotal, quotation.currency)}</span>
              </div>
              {quotation.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({quotation.taxRate}%)</span>
                  <span className="text-foreground">{formatCurrency(tax, quotation.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t-2 border-border">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatCurrency(total, quotation.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="pt-6 border-t">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">NOTES</h2>
              <p className="text-muted-foreground whitespace-pre-line">{quotation.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
