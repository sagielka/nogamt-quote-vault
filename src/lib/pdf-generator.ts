import { Quotation } from '@/types/quotation';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import jsPDF from 'jspdf';
import logoImg from '@/assets/logo.png';
import thinkingInsideImg from '@/assets/thinking-inside-new.png';

export type GeneratedPdf = {
  blob: Blob;
  fileName: string;
};

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<{ data: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve({
        data: canvas.toDataURL('image/png'),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = src;
  });
};

// Helper to detect if text contains Hebrew characters
const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

// Split text into directional runs (Hebrew vs non-Hebrew segments)
const splitBidiRuns = (text: string): { text: string; isHebrew: boolean }[] => {
  const runs: { text: string; isHebrew: boolean }[] = [];
  const regex = /([\u0590-\u05FF\u0027\u0022]+(?:\s+[\u0590-\u05FF\u0027\u0022]+)*)|([^\u0590-\u05FF]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      runs.push({ text: match[1], isHebrew: true });
    } else if (match[2]) {
      runs.push({ text: match[2], isHebrew: false });
    }
  }
  return runs;
};

// Process text for RTL rendering in jsPDF
// jsPDF always renders LTR, so we need to manually reorder for correct visual display.
// For mixed bidi text: reverse Hebrew runs internally, then reverse overall run order.
const processText = (text: string): string => {
  if (!containsHebrew(text)) return text;
  
  const runs = splitBidiRuns(text);
  
  // If pure Hebrew (single run), just reverse characters
  if (runs.length === 1 && runs[0].isHebrew) {
    return text.split('').reverse().join('');
  }
  
  // For mixed content: reverse each Hebrew run's characters, keep LTR runs as-is,
  // then reverse the order of all runs so RTL base direction is correct
  const processedRuns = runs.map(run => {
    if (run.isHebrew) {
      // Reverse characters within Hebrew run
      return run.text.split('').reverse().join('');
    }
    return run.text;
  });
  
  // Reverse run order for RTL base direction
  processedRuns.reverse();
  
  return processedRuns.join('');
};

// Load font as base64
const loadFontAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Register Hebrew-supporting fonts with jsPDF
let hebrewFontRegistered = false;
const registerFonts = async (pdf: jsPDF) => {
  try {
    // Heebo supports both Latin and Hebrew
    const heeboBase64 = await loadFontAsBase64('/fonts/Heebo-Variable.ttf');
    
    pdf.addFileToVFS('Heebo-Regular.ttf', heeboBase64);
    pdf.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
    
    // Use same font for bold (variable font handles weight internally)
    pdf.addFileToVFS('Heebo-Bold.ttf', heeboBase64);
    pdf.addFont('Heebo-Bold.ttf', 'Heebo', 'bold');
    
    hebrewFontRegistered = true;
  } catch (e) {
    console.warn('Could not load Heebo font, falling back to helvetica:', e);
    hebrewFontRegistered = false;
  }
};

// Helper to set font - uses Heebo for Hebrew text, helvetica otherwise
const setFont = (pdf: jsPDF, style: 'normal' | 'bold' = 'normal') => {
  if (hebrewFontRegistered) {
    pdf.setFont('Heebo', style);
  } else {
    pdf.setFont('helvetica', style);
  }
};

// Helper to get text alignment for potentially Hebrew text
const getAlign = (text: string, defaultAlign: string = 'left'): string => {
  if (containsHebrew(text)) return 'right';
  return defaultAlign;
};

// Helper to wrap text and return lines
const wrapText = (pdf: jsPDF, text: string, maxWidth: number): string[] => {
  if (!text) return [''];
  const processed = processText(text);
  return pdf.splitTextToSize(processed, maxWidth) as string[];
};

export const generateQuotationPdf = async (quotation: Quotation): Promise<GeneratedPdf> => {
  const subtotal = calculateSubtotal(quotation.items);
  const discount = calculateDiscount(subtotal, quotation.discountType || 'percentage', quotation.discountValue || 0);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, quotation.taxRate);
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Register Unicode fonts
  await registerFonts(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerBaselineY = pageHeight - 15;
  const footerLineY = footerBaselineY - 3;
  const contentBottom = footerLineY - 4;
  let y = margin;

  // Colors
  const cyan = [8, 145, 178] as const; // #0891b2
  const black = [26, 26, 26] as const;
  const gray = [102, 102, 102] as const;
  const lightGray = [209, 213, 219] as const;
  const red = [220, 38, 38] as const;

  // Load logos
  try {
    const [logo, thinking] = await Promise.all([
      loadImageAsBase64(logoImg),
      loadImageAsBase64(thinkingInsideImg),
    ]);

    // Draw logos preserving natural aspect ratios with white background
    const targetH = 14;
    const logoPad = 1; // padding around logo

    const logoW = (logo.width / logo.height) * targetH;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin - logoPad, y - logoPad, logoW + logoPad * 2, targetH + logoPad * 2, 'F');
    pdf.addImage(logo.data, 'PNG', margin, y, logoW, targetH);
    
    const thinkingW = (thinking.width / thinking.height) * targetH;
    const thinkingX = pageWidth - margin - thinkingW;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(thinkingX - logoPad, y - logoPad, thinkingW + logoPad * 2, targetH + logoPad * 2, 'F');
    pdf.addImage(thinking.data, 'PNG', thinkingX, y, thinkingW, targetH);
  } catch (e) {
    console.warn('Could not load logo images:', e);
  }

  y += 30;

  // Title
  pdf.setFontSize(18);
  setFont(pdf, 'bold');
  pdf.setTextColor(...cyan);
  const titleText = 'QUOTATION  ';
  const titleWidth = pdf.getTextWidth(titleText);
  const quoteNum = quotation.quoteNumber.replace(/^QT/i, '');
  const numWidth = pdf.getTextWidth(quoteNum);
  const totalTitleWidth = titleWidth + numWidth;
  const titleX = (pageWidth - totalTitleWidth) / 2;

  pdf.text(titleText, titleX, y);
  pdf.setTextColor(...black);
  pdf.text(quoteNum, titleX + titleWidth, y);

  y += 10;

  // Dates - right aligned
  pdf.setFontSize(9);
  setFont(pdf, 'normal');
  pdf.setTextColor(...gray);
  const createdText = `Created: ${formatDate(quotation.createdAt)}`;
  const validText = `Valid Until: ${formatDate(quotation.validUntil)}`;
  pdf.text(createdText, pageWidth - margin, y, { align: 'right' });
  y += 4;
  pdf.text(validText, pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Separator line
  pdf.setDrawColor(...lightGray);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Bill To
  pdf.setFontSize(8);
  pdf.setTextColor(...gray);
  setFont(pdf, 'normal');
  pdf.text('BILL TO', margin, y);
  y += 5;

  pdf.setFontSize(10);
  pdf.setTextColor(...black);
  setFont(pdf, 'bold');
  const clientNameProcessed = processText(quotation.clientName);
  const clientNameIsHebrew = containsHebrew(quotation.clientName);
  if (clientNameIsHebrew) {
    pdf.text(clientNameProcessed, pageWidth - margin, y, { align: 'right' });
  } else {
    pdf.text(clientNameProcessed, margin, y);
  }
  y += 4.5;

  setFont(pdf, 'normal');
  pdf.setTextColor(...gray);
  pdf.setFontSize(9);
  pdf.text(quotation.clientEmail, margin, y);
  y += 4.5;

  if (quotation.clientAddress) {
    const addressLines = quotation.clientAddress.split('\n');
    for (const line of addressLines) {
      const processedLine = processText(line);
      const lineIsHebrew = containsHebrew(line);
      if (lineIsHebrew) {
        pdf.text(processedLine, pageWidth - margin, y, { align: 'right' });
      } else {
        pdf.text(processedLine, margin, y);
      }
      y += 4;
    }
  }

  y += 6;

  // Table header
  const colX = {
    num: margin,
    sku: margin + 8,
    desc: margin + 30,
    lt: margin + 85,
    moq: margin + 100,
    price: margin + 118,
    disc: margin + 148,
    total: pageWidth - margin,
  };
  const descWidth = 53;

  pdf.setFontSize(8);
  setFont(pdf, 'bold');
  pdf.setTextColor(...gray);
  pdf.text('#', colX.num, y);
  pdf.text('SKU', colX.sku, y);
  pdf.text('Description', colX.desc, y);
  pdf.text('LT (wks)', colX.lt, y, { align: 'center' });
  pdf.text('MOQ', colX.moq, y, { align: 'center' });
  pdf.text(`Unit Price (${quotation.currency})`, colX.price + 14, y, { align: 'right' });
  pdf.text('Disc %', colX.disc, y, { align: 'center' });
  pdf.text('Total', colX.total, y, { align: 'right' });

  y += 2;
  pdf.setDrawColor(...lightGray);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Table rows
  setFont(pdf, 'normal');
  pdf.setFontSize(8);

  for (let i = 0; i < quotation.items.length; i++) {
    const item = quotation.items[i];
    const lineTotal = calculateLineTotal(item);

    // Calculate row height based on description wrapping
    const descLines = wrapText(pdf, item.description || '—', descWidth);
    const noteLines = item.notes ? wrapText(pdf, `Note: ${item.notes}`, descWidth) : [];
    const rowHeight = Math.max(
      (descLines.length + noteLines.length) * 4 + (noteLines.length > 0 ? 4 : 0),
      8
    );

    // Check for page break
    if (y + rowHeight > contentBottom) {
      pdf.addPage();
      y = margin;
    }

    const rowY = y;

    pdf.setTextColor(...gray);
    pdf.text(String(i + 1), colX.num, rowY);

    setFont(pdf, 'normal');
    pdf.setFontSize(8);
    pdf.text(item.sku || '—', colX.sku, rowY);

    setFont(pdf, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...black);
    pdf.text(descLines, colX.desc, rowY);

    if (noteLines.length > 0) {
      const noteY = rowY + descLines.length * 4 + 2;
      pdf.setFontSize(7);
      pdf.setTextColor(...gray);
      pdf.text(noteLines, colX.desc, noteY);
      pdf.setFontSize(8);
    }

    pdf.setTextColor(...gray);
    pdf.text(item.leadTime || '—', colX.lt, rowY, { align: 'center' });
    pdf.text(String(item.moq || 1), colX.moq, rowY, { align: 'center' });
    pdf.text(formatCurrency(item.unitPrice, quotation.currency), colX.price + 14, rowY, { align: 'right' });
    pdf.text(item.discountPercent ? `${item.discountPercent}%` : '—', colX.disc, rowY, { align: 'center' });

    pdf.setTextColor(...black);
    setFont(pdf, 'bold');
    pdf.text(formatCurrency(lineTotal, quotation.currency), colX.total, rowY, { align: 'right' });
    setFont(pdf, 'normal');

    y += rowHeight + 1.5;

    // Row separator
    pdf.setDrawColor(229, 229, 229);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 3;
  }

  y += 4;

  // Check for page break before totals
  if (y + 30 > contentBottom) {
    pdf.addPage();
    y = margin;
  }

  // Totals section - right aligned
  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;

  pdf.setFontSize(9);
  setFont(pdf, 'normal');
  pdf.setTextColor(...gray);
  pdf.text('Subtotal', totalsX, y);
  pdf.setTextColor(...black);
  pdf.text(formatCurrency(subtotal, quotation.currency), totalsValueX, y, { align: 'right' });
  y += 5;

  if (discount > 0) {
    pdf.setTextColor(...gray);
    const discLabel = quotation.discountType === 'percentage' ? `Discount (${quotation.discountValue}%)` : 'Discount';
    pdf.text(discLabel, totalsX, y);
    pdf.setTextColor(...red);
    pdf.text(`-${formatCurrency(discount, quotation.currency)}`, totalsValueX, y, { align: 'right' });
    y += 5;
  }

  if (quotation.taxRate > 0) {
    pdf.setTextColor(...gray);
    pdf.text(`Tax (${quotation.taxRate}%)`, totalsX, y);
    pdf.setTextColor(...black);
    pdf.text(formatCurrency(tax, quotation.currency), totalsValueX, y, { align: 'right' });
    y += 5;
  }

  // Total line
  pdf.setDrawColor(...lightGray);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX, y, pageWidth - margin, y);
  y += 5;

  pdf.setFontSize(11);
  setFont(pdf, 'bold');
  pdf.setTextColor(...black);
  pdf.text('Total', totalsX, y);
  pdf.setTextColor(...cyan);
  pdf.text(formatCurrency(total, quotation.currency), totalsValueX, y, { align: 'right' });
  y += 10;

  // Notes
  if (quotation.notes) {
    const noteLines = wrapText(pdf, quotation.notes, contentWidth);
    const notesSectionHeight = 5 + 4 + noteLines.length * 3.2 + 4;

    if (y + notesSectionHeight > contentBottom) {
      pdf.addPage();
      y = margin;
    }

    pdf.setDrawColor(229, 229, 229);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 5;

    pdf.setFontSize(8);
    setFont(pdf, 'normal');
    pdf.setTextColor(...gray);
    pdf.text('NOTES', margin, y);
    y += 4;

    pdf.setFontSize(8);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 3.2 + 4;
  }

  // Footer
  const fY = footerBaselineY;

  pdf.setDrawColor(229, 229, 229);
  pdf.setLineWidth(0.2);
  pdf.line(margin, footerLineY, pageWidth - margin, footerLineY);

  pdf.setFontSize(8);
  setFont(pdf, 'bold');
  pdf.setTextColor(...black);
  pdf.text('Noga Engineering & Technology Ltd.', pageWidth / 2, fY, { align: 'center' });

  setFont(pdf, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...gray);
  pdf.text('Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel', pageWidth / 2, fY + 4, { align: 'center' });

  pdf.setTextColor(...cyan);
  pdf.text('www.nogamt.com', pageWidth / 2, fY + 8, { align: 'center' });

  const fileName = `${quotation.quoteNumber.replace(/^QT/i, '')}.pdf`;
  return {
    blob: pdf.output('blob'),
    fileName,
  };
};

export const getQuotationPdfBase64 = async (quotation: Quotation): Promise<{ base64: string; fileName: string }> => {
  const { blob, fileName } = await generateQuotationPdf(quotation);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, fileName });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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