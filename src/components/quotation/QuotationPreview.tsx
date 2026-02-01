import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { generateQuotationPdf, downloadQuotationPdf } from '@/lib/pdf-generator';
import { ArrowLeft, Printer, Download, Pencil, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';
import thinkingInside from '@/assets/thinking-inside-new.png';

// Declare electron API types
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      getAppVersion?: () => Promise<string>;
      emailWithAttachment: (
        pdfData: string,
        fileName: string,
        recipientEmail: string,
        subject: string,
        body: string
      ) => Promise<{ success: boolean; fallback?: boolean; pdfPath?: string; error?: string }>;
    };
  }
}

interface QuotationPreviewProps {
  quotation: Quotation;
  onBack: () => void;
  onEdit?: () => void;
}

export const QuotationPreview = ({ quotation, onBack, onEdit }: QuotationPreviewProps) => {
  const { toast } = useToast();
  const subtotal = calculateSubtotal(quotation.items);
  const discount = calculateDiscount(subtotal, quotation.discountType || 'percentage', quotation.discountValue || 0);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, quotation.taxRate);
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    toast({
      title: 'Generating PDF...',
      description: 'Please wait while the PDF is being created.',
    });

    const result = await downloadQuotationPdf(quotation);

    if (result.success) {
      toast({
        title: 'PDF Downloaded',
        description: `${result.fileName} has been saved.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again or use print.',
        variant: 'destructive',
      });
    }
  };

  const handleEmailQuote = async () => {
    // Check if running in Electron
    if (!window.electronAPI?.isElectron) {
      toast({
        title: 'Email Feature',
        description: 'Email with attachment is only available in the desktop app.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Preparing Email...',
      description: 'Generating PDF and opening Outlook.',
    });

    try {
      const { blob, fileName } = await generateQuotationPdf(quotation);
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const subject = `Quotation ${quotation.quoteNumber} from Noga Engineering & Technology Ltd.`;
      const body = `Dear ${quotation.clientName},

Please find attached our quotation ${quotation.quoteNumber} for your review.

Total: ${formatCurrency(total, quotation.currency)}
Valid Until: ${formatDate(quotation.validUntil)}

If you have any questions, please don't hesitate to contact us.

Best regards,
Noga Engineering & Technology Ltd.`;

      const result = await window.electronAPI.emailWithAttachment(
        base64Data,
        fileName,
        quotation.clientEmail,
        subject,
        body
      );

      if (result.success) {
        if (result.fallback) {
          toast({
            title: 'PDF Saved',
            description: 'Outlook not available. PDF saved and folder opened.',
          });
        } else {
          toast({
            title: 'Email Ready',
            description: 'Outlook opened with the PDF attached.',
          });
        }
      } else {
        throw new Error(result.error || 'Failed to prepare email');
      }
    } catch (error) {
      console.error('Error preparing email:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare email. Please try downloading the PDF instead.',
        variant: 'destructive',
      });
    }
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
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleEmailQuote}>
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button variant="accent" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Quotation Document */}
      <Card className="card-elevated max-w-4xl mx-auto print:shadow-none print:border-none">
        <CardContent className="p-8 md:p-12">
          {/* Print Header with Logos */}
          <div className="hidden print:flex justify-between items-start mb-6">
            <img src={logo} alt="NogaMT Logo" className="h-12 w-auto" />
            <img src={thinkingInside} alt="Thinking Inside" className="h-12 w-auto" />
          </div>

          {/* Header */}
          <div className="mb-8 pb-8 border-b print:pt-0">
            <h1 className="heading-display text-3xl text-primary mb-4 print:text-cyan-600 text-center">
              QUOTATION <span className="text-foreground print:text-gray-900">{quotation.quoteNumber.replace(/^QT/i, '')}</span>
            </h1>
            <div className="flex flex-col md:flex-row justify-between items-start">
              <div></div>
              <div className="mt-4 md:mt-0 text-right print:text-left">
                <p className="text-sm text-muted-foreground mt-2 print:text-gray-600 print:mt-0">
                  Created: {formatDate(quotation.createdAt)}
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-600">
                  Valid Until: {formatDate(quotation.validUntil)}
                </p>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-2 print:text-gray-500">BILL TO</h2>
            <p className="font-semibold text-foreground print:text-gray-900">{quotation.clientName}</p>
            <p className="text-muted-foreground print:text-gray-600">{quotation.clientEmail}</p>
            {quotation.clientAddress && (
              <p className="text-muted-foreground whitespace-pre-line print:text-gray-600">{quotation.clientAddress}</p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border print:border-gray-300">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground w-8 print:text-gray-500">#</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground w-24 print:text-gray-500">SKU</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground print:text-gray-500">Description</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">LT (wks)</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">MOQ</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-28 print:text-gray-500">Unit Price ({quotation.currency})</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">Disc %</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-24 print:text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-border print:border-gray-200">
                    <td className="py-4 text-muted-foreground print:text-gray-600 align-top">{index + 1}</td>
                    <td className="py-4 text-foreground font-mono text-sm print:text-gray-900 align-top">{item.sku || '—'}</td>
                    <td className="py-4 text-foreground print:text-gray-900 align-top">
                      <div>{item.description || '—'}</div>
                      {item.notes && (
                        <div className="text-xs text-muted-foreground mt-1 italic print:text-gray-500">
                          Note: {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">{item.leadTime || '—'}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">{item.moq || 1}</td>
                    <td className="py-4 text-right text-muted-foreground print:text-gray-600 align-top">{formatCurrency(item.unitPrice, quotation.currency)}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">
                      {item.discountPercent ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="py-4 text-right font-medium text-foreground print:text-gray-900 align-top">
                      {formatCurrency(calculateLineTotal(item), quotation.currency)}
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
                <span className="text-muted-foreground print:text-gray-500">Subtotal</span>
                <span className="text-foreground print:text-gray-900">{formatCurrency(subtotal, quotation.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">
                    Discount {quotation.discountType === 'percentage' ? `(${quotation.discountValue}%)` : ''}
                  </span>
                  <span className="text-destructive print:text-red-600">-{formatCurrency(discount, quotation.currency)}</span>
                </div>
              )}
              {quotation.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">Tax ({quotation.taxRate}%)</span>
                  <span className="text-foreground print:text-gray-900">{formatCurrency(tax, quotation.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t-2 border-border print:border-gray-300">
                <span className="text-foreground print:text-gray-900">Total</span>
                <span className="text-primary print:text-cyan-600">{formatCurrency(total, quotation.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="pt-6 border-t print:border-gray-200">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 print:text-gray-500">NOTES</h2>
              <p className="text-muted-foreground whitespace-pre-line print:text-gray-600">{quotation.notes}</p>
            </div>
          )}

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-center">
            <p className="font-semibold text-gray-900 text-xs">Noga Engineering & Technology Ltd.</p>
            <p className="text-[10px] text-gray-600">Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
            <p className="text-[10px] text-cyan-600">www.nogamt.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
