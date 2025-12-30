export type Currency = 'USD' | 'EUR' | 'GBP' | 'ILS' | 'JPY' | 'CNY';

export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'ILS', label: 'Israeli Shekel', symbol: '₪' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
];

export interface LineItemAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  lineItemIndex: number;
}

export interface LineItem {
  id: string;
  sku: string;
  description: string;
  moq: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: LineItem[];
  taxRate: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  notes: string;
  createdAt: Date;
  validUntil: Date;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  currency: Currency;
  attachments: LineItemAttachment[];
}

export type QuotationFormData = Omit<Quotation, 'id' | 'createdAt' | 'quoteNumber'>;
