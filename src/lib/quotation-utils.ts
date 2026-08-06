import { LineItem, Quotation, Currency } from '@/types/quotation';

// Generate the base prefix for quote numbers (MTddmmyy)
export const getQuoteDatePrefix = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `MT${day}${month}${year}`;
};

// Clean customer name for use in quote number
export const cleanCustomerName = (customerName: string = ''): string => {
  // Remove email in parentheses from customer name
  const cleanName = customerName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return cleanName.toUpperCase();
};

// Generate quote number with index: MTddmmyy-01-CUSTOMERNAME
export const generateQuoteNumber = (
  customerName: string = '', 
  existingQuoteNumbers: string[] = [],
  isCopy: boolean = false
): string => {
  const datePrefix = getQuoteDatePrefix();
  const formattedName = cleanCustomerName(customerName);
  const suffix = isCopy ? '-COPY' : '';
  
  // Find the highest index for this customer on this date
  const pattern = new RegExp(`^${datePrefix}-(\\d{2})-${formattedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-COPY)?$`, 'i');
  
  let maxIndex = 0;
  for (const quoteNum of existingQuoteNumbers) {
    const match = quoteNum.match(pattern);
    if (match) {
      const index = parseInt(match[1], 10);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
  }
  
  const nextIndex = String(maxIndex + 1).padStart(2, '0');
  
  return formattedName 
    ? `${datePrefix}-${nextIndex}-${formattedName}${suffix}` 
    : `${datePrefix}-${nextIndex}${suffix}`;
};

// ---- US... quantity price breaks -------------------------------------------
// Base price (the unit price typed on the line) is the price for 5 pcs.
// 2 pcs is 30% higher than 5; each step down in price:
// 5 -> 10 = -28%, 10 -> 25 = -23%, 25 -> 50 = -10%, 50 -> 100 = -6%.
export const US_PRICE_TIERS = [2, 5, 10, 25, 50, 100] as const;

const TIER_MULTIPLIERS: Record<number, number> = (() => {
  const m5 = 1;
  const m10 = m5 * (1 - 0.28);
  const m25 = m10 * (1 - 0.23);
  const m50 = m25 * (1 - 0.10);
  const m100 = m50 * (1 - 0.06);
  return { 2: m5 * 1.3, 5: m5, 10: m10, 25: m25, 50: m50, 100: m100 };
})();

export const isUsPriceBreakItem = (item: Pick<LineItem, 'sku' | 'description'>): boolean => {
  const test = (v?: string) => /^US[\s-]?\d|^US-/i.test((v || '').trim());
  return test(item.sku) || test(item.description);
};

// Unit price for a given tier quantity, before line discount.
export const getTierUnitPrice = (basePrice: number, qty: number): number => {
  const mult = TIER_MULTIPLIERS[qty];
  return mult != null ? basePrice * mult : basePrice;
};

// Unit price for a tier after the line discount.
export const getTierNetUnitPrice = (item: LineItem, qty: number): number =>
  getTierUnitPrice(item.unitPrice, qty) * (1 - (item.discountPercent || 0) / 100);

export const getActivePriceBreaks = (item: LineItem): number[] =>
  (item.priceBreaks || []).filter((q) => TIER_MULTIPLIERS[q] != null).sort((a, b) => a - b);

// For customer-facing output: skip the tier that duplicates the row's own quantity.
export const getDisplayPriceBreaks = (item: LineItem): number[] =>
  getActivePriceBreaks(item)
    .filter((q) => Number(q) !== Number(item.moq))
    .sort((a, b) => a - b);

// Whether a given quantity row should be emphasised (customer requested qty).
export const isHighlightedQty = (
  item: Pick<LineItem, 'highlightQty'>,
  qty: number
): boolean => item.highlightQty != null && Number(item.highlightQty) === Number(qty);

export const calculateLineTotal = (item: LineItem): number => {
  // When the customer picked a specific (bolded) quantity from the price
  // breaks, the line total — and therefore subtotal/total — follows that
  // chosen base quantity and its tier price.
  const chosenQty =
    item.highlightQty != null && Number(item.highlightQty) > 0
      ? Number(item.highlightQty)
      : Number(item.moq);
  const unit =
    getActivePriceBreaks(item).length > 0 ? getTierUnitPrice(item.unitPrice, chosenQty) : item.unitPrice;
  const gross = chosenQty * unit;
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
    case 'finished':
      return 'bg-orange-500/15 text-orange-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const createEmptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  sku: '',
  description: '',
  leadTime: '',
  moq: 1,
  unitPrice: 0,
  discountPercent: 0,
  notes: '',
});
