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
  leadTime: string;
  moq: number;
  unitPrice: number;
  discountPercent: number;
  notes?: string;
}

export interface Quotation {
  id: string;
  userId: string;
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
  reminderSentAt: Date | null;
  followUpNotifiedAt: Date | null;
}

export type QuotationFormData = Omit<Quotation, 'id' | 'userId' | 'createdAt' | 'quoteNumber' | 'reminderSentAt' | 'followUpNotifiedAt'> & {
  quoteNumber?: string; // Optional: allows manual override when editing
};
