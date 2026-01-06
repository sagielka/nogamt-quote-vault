import { Quotation } from '@/types/quotation';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { escapeHtml } from '@/lib/html-sanitize';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logo from '@/assets/logo.png';
import thinkingInside from '@/assets/thinking-inside-new.png';

export type GeneratedPdf = {
  blob: Blob;
  fileName: string;
};

export const generateQuotationPdf = async (quotation: Quotation): Promise<GeneratedPdf> => {
  const subtotal = calculateSubtotal(quotation.items);
  const discount = calculateDiscount(subtotal, quotation.discountType || 'percentage', quotation.discountValue || 0);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, quotation.taxRate);
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

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

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

  const fileName = `${quotation.quoteNumber.replace(/^QT/i, '')}.pdf`;
  return {
    blob: pdf.output('blob'),
    fileName,
  };
};

export const downloadQuotationPdf = async (quotation: Quotation): Promise<{ success: boolean; fileName?: string; error?: string }> => {
  try {
    const { blob, fileName } = await generateQuotationPdf(quotation);

    const pdfUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(pdfUrl);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
