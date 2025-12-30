import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { escapeHtml } from '@/lib/html-sanitize';
import { ArrowLeft, Printer, Download, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logo from '@/assets/logo.jpg';
import thinkingInside from '@/assets/thinking-inside-new.png';

interface QuotationPreviewProps {
  quotation: Quotation;
  onBack: () => void;
  onEdit?: () => void;
}

type GeneratedPdf = {
  blob: Blob;
  fileName: string;
};

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

  const generatePrintStylePdf = async (): Promise<GeneratedPdf> => {
    // Create a hidden container with print styles
    const printContainer = document.createElement('div');
    printContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      background: white;
      padding: 40px;
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 11px;
      color: #1a1a1a;
    `;

    // Escape all user-provided content to prevent XSS
    const safeClientName = escapeHtml(quotation.clientName);
    const safeClientEmail = escapeHtml(quotation.clientEmail);
    const safeClientAddress = escapeHtml(quotation.clientAddress);
    const safeNotes = escapeHtml(quotation.notes);
    const safeQuoteNumber = escapeHtml(quotation.quoteNumber.replace(/^QT/i, ''));

    printContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <img src="${logo}" alt="NogaMT Logo" style="height: 48px; width: auto;" crossorigin="anonymous" />
        <img src="${thinkingInside}" alt="Thinking Inside" style="height: 48px; width: auto;" crossorigin="anonymous" />
      </div>

      <h1 style="text-align: center; color: #0891b2; font-size: 24px; margin-bottom: 16px; font-weight: bold;">
        QUOTATION <span style="color: #1a1a1a;">${safeQuoteNumber}</span>
      </h1>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e5e5;">
        <div style="text-align: left;">
          <p style="color: #666; font-size: 11px; margin: 0;">Created: ${formatDate(quotation.createdAt)}</p>
          <p style="color: #666; font-size: 11px; margin: 0;">Valid Until: ${formatDate(quotation.validUntil)}</p>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 10px; color: #666; margin-bottom: 8px; font-weight: 500;">BILL TO</h2>
        <p style="font-weight: 600; margin: 0;">${safeClientName}</p>
        <p style="color: #666; margin: 0;">${safeClientEmail}</p>
        ${safeClientAddress ? `<p style="color: #666; margin: 0; white-space: pre-line;">${safeClientAddress}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10px;">
        <thead>
          <tr style="border-bottom: 2px solid #d1d5db;">
            <th style="text-align: left; padding: 8px 4px; color: #666; font-weight: 500; width: 30px;">#</th>
            <th style="text-align: left; padding: 8px 4px; color: #666; font-weight: 500; width: 80px;">SKU</th>
            <th style="text-align: left; padding: 8px 4px; color: #666; font-weight: 500;">Description</th>
            <th style="text-align: center; padding: 8px 4px; color: #666; font-weight: 500; width: 50px;">LT (wks)</th>
            <th style="text-align: center; padding: 8px 4px; color: #666; font-weight: 500; width: 50px;">MOQ</th>
            <th style="text-align: right; padding: 8px 4px; color: #666; font-weight: 500; width: 80px;">Unit Price (${quotation.currency})</th>
            <th style="text-align: center; padding: 8px 4px; color: #666; font-weight: 500; width: 50px;">Disc %</th>
            <th style="text-align: right; padding: 8px 4px; color: #666; font-weight: 500; width: 80px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${quotation.items.map((item, index) => `
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 12px 4px; color: #666;">${index + 1}</td>
              <td style="padding: 12px 4px; font-family: monospace; font-size: 9px;">${escapeHtml(item.sku) || '—'}</td>
              <td style="padding: 12px 4px;">${escapeHtml(item.description) || '—'}</td>
              <td style="padding: 12px 4px; text-align: center; color: #666;">${item.leadTime || '—'}</td>
              <td style="padding: 12px 4px; text-align: center; color: #666;">${item.moq || 1}</td>
              <td style="padding: 12px 4px; text-align: right; color: #666;">${formatCurrency(item.unitPrice, quotation.currency)}</td>
              <td style="padding: 12px 4px; text-align: center; color: #666;">${item.discountPercent ? `${item.discountPercent}%` : '—'}</td>
              <td style="padding: 12px 4px; text-align: right; font-weight: 500;">${formatCurrency(calculateLineTotal(item), quotation.currency)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
        <div style="width: 220px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
            <span style="color: #666;">Subtotal</span>
            <span>${formatCurrency(subtotal, quotation.currency)}</span>
          </div>
          ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
              <span style="color: #666;">Discount ${quotation.discountType === 'percentage' ? `(${quotation.discountValue}%)` : ''}</span>
              <span style="color: #dc2626;">-${formatCurrency(discount, quotation.currency)}</span>
            </div>
          ` : ''}
          ${quotation.taxRate > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
              <span style="color: #666;">Tax (${quotation.taxRate}%)</span>
              <span>${formatCurrency(tax, quotation.currency)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; padding-top: 8px; border-top: 2px solid #d1d5db;">
            <span>Total</span>
            <span style="color: #0891b2;">${formatCurrency(total, quotation.currency)}</span>
          </div>
        </div>
      </div>

      ${safeNotes ? `
        <div style="padding-top: 16px; border-top: 1px solid #e5e5e5;">
          <h2 style="font-size: 10px; color: #666; margin-bottom: 8px; font-weight: 500;">NOTES</h2>
          <p style="color: #666; white-space: pre-line; font-size: 10px;">${safeNotes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center;">
        <p style="font-weight: 600; font-size: 10px; margin: 0;">Noga Engineering & Technology Ltd.</p>
        <p style="font-size: 9px; color: #666; margin: 4px 0;">Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
        <p style="font-size: 9px; color: #0891b2; margin: 0;">www.nogamt.com</p>
      </div>
    `;

    document.body.appendChild(printContainer);

    // Wait for images to load
    const images = printContainer.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    const canvas = await html2canvas(printContainer, {
      useCORS: true,
      logging: false,
      background: '#ffffff',
      // Higher scale = sharper PDF
      scale: 3,
    } as Parameters<typeof html2canvas>[1]);

    document.body.removeChild(printContainer);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    // Use PNG for maximum quality
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

    const fileName = `${quotation.quoteNumber.replace(/^QT/i, '')}.pdf`;
    return {
      blob: pdf.output('blob'),
      fileName,
    };
  };

  const handleDownloadPdf = async () => {
    toast({
      title: 'Generating PDF...',
      description: 'Please wait while the PDF is being created.',
    });

    try {
      const { blob, fileName } = await generatePrintStylePdf();

      const pdfUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(pdfUrl);

      toast({
        title: 'PDF Downloaded',
        description: `${fileName} has been saved.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again or use print.',
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
                    <td className="py-4 text-muted-foreground print:text-gray-600">{index + 1}</td>
                    <td className="py-4 text-foreground font-mono text-sm print:text-gray-900">{item.sku || '—'}</td>
                    <td className="py-4 text-foreground print:text-gray-900">
                      <div>{item.description || '—'}</div>
                    </td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600">{item.leadTime || '—'}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600">{item.moq || 1}</td>
                    <td className="py-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(item.unitPrice, quotation.currency)}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600">
                      {item.discountPercent ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="py-4 text-right font-medium text-foreground print:text-gray-900">
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