import { LineItem, Quotation, Currency } from '@/types/quotation';

export const generateQuoteNumber = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `QTMT${day}${month}${year}`;
};

export const calculateLineTotal = (item: LineItem): number => {
  const gross = item.quantity * item.unitPrice;
  const lineDiscount = gross * ((item.discountPercent || 0) / 100);
  return gross - lineDiscount;
};

export const calculateSubtotal = (items: LineItem[]): number => {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
};

export const calculateTax = (subtotal: number, taxRate: number): number => {
  return subtotal * (taxRate / 100);
};

export const calculateDiscount = (
  subtotal: number, 
  discountType: 'percentage' | 'fixed', 
  discountValue: number
): number => {
  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100);
  }
  return discountValue;
};

export const calculateTotal = (
  items: LineItem[], 
  taxRate: number,
  discountType: 'percentage' | 'fixed' = 'percentage',
  discountValue: number = 0
): number => {
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountType, discountValue);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, taxRate);
  return afterDiscount + tax;
};

export const formatCurrency = (amount: number, currency: Currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const getStatusColor = (status: Quotation['status']): string => {
  switch (status) {
    case 'draft':
      return 'bg-muted text-muted-foreground';
    case 'sent':
      return 'bg-primary/10 text-primary';
    case 'accepted':
      return 'bg-success/10 text-success';
    case 'declined':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const createEmptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
});
