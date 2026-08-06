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

// ---- US... / UC... quantity price breaks -----------------------------------
// Base price (the unit price typed on the line) is always the price for 5 pcs.
// 2 pcs is 30% higher than 5 pcs; the 10/25/50/100 columns are step discounts
// applied to the previous tier, and they differ per family (US/UC) and per
// insert group letter (B-G) taken from the description.
export const US_PRICE_TIERS = [2, 5, 10, 25, 50, 100] as const;

type StepSet = { s10: number; s25: number; s50: number; s100: number };

const US_STEPS: Record<string, StepSet> = {
  B: { s10: 0.28, s25: 0.23, s50: 0.10, s100: 0.06 },
  C: { s10: 0.27, s25: 0.22, s50: 0.09, s100: 0.05 },
  D: { s10: 0.29, s25: 0.24, s50: 0.11, s100: 0.06 },
  E: { s10: 0.27, s25: 0.22, s50: 0.09, s100: 0.05 },
  F: { s10: 0.26, s25: 0.21, s50: 0.09, s100: 0.05 },
  G: { s10: 0.23, s25: 0.18, s50: 0.07, s100: 0.04 },
};

const UC_STEPS: Record<string, StepSet> = {
  B: { s10: 0.31, s25: 0.26, s50: 0.12, s100: 0.07 },
  C: { s10: 0.29, s25: 0.24, s50: 0.11, s100: 0.06 },
  D: { s10: 0.30, s25: 0.30, s50: 0.13, s100: 0.07 },
  E: { s10: 0.30, s25: 0.25, s50: 0.11, s100: 0.06 },
  F: { s10: 0.29, s25: 0.24, s50: 0.11, s100: 0.06 },
  G: { s10: 0.28, s25: 0.23, s50: 0.10, s100: 0.06 },
};

const DEFAULT_STEPS: StepSet = { s10: 0.28, s25: 0.23, s50: 0.10, s100: 0.06 };

const buildMultipliers = (steps: StepSet): Record<number, number> => {
  const m5 = 1;
  const m10 = m5 * (1 - steps.s10);
  const m25 = m10 * (1 - steps.s25);
  const m50 = m25 * (1 - steps.s50);
  const m100 = m50 * (1 - steps.s100);
  return { 2: m5 * 1.3, 5: m5, 10: m10, 25: m25, 50: m50, 100: m100 };
};

const TIER_MULTIPLIERS: Record<number, number> = buildMultipliers(DEFAULT_STEPS);

// Insert group letter (B-G) from a description like "US-d140-D300-D-R04-PL-NCT".
export const getInsertGroupLetter = (description?: string): string | null => {
  const upper = (description || '').toUpperCase();
  if (!upper) return null;
  const letters = ['B', 'C', 'D', 'E', 'F', 'G'];
  const parts = upper.split('-');
  if (parts.length >= 4 && parts[3].length === 1 && letters.includes(parts[3])) return parts[3];
  for (const l of letters) {
    if (upper.includes(`-${l}-`)) return l;
  }
  return null;
};

const getItemFamily = (item: Pick<LineItem, 'sku' | 'description'>): 'US' | 'UC' | null => {
  const src = `${item.sku || ''} ${item.description || ''}`.trim().toUpperCase();
  if (/(^|\s)US[\s-]?\d|(^|\s)US-/.test(src)) return 'US';
  if (/(^|\s)UC[\s-]?\d|(^|\s)UC-/.test(src)) return 'UC';
  return null;
};

const getItemMultipliers = (item: Pick<LineItem, 'sku' | 'description'>): Record<number, number> => {
  const family = getItemFamily(item);
  const letter = getInsertGroupLetter(item.description) || getInsertGroupLetter(item.sku);
  const table = family === 'UC' ? UC_STEPS : family === 'US' ? US_STEPS : null;
  const steps = (table && letter && table[letter]) || DEFAULT_STEPS;
  return buildMultipliers(steps);
};

export const isUsPriceBreakItem = (item: Pick<LineItem, 'sku' | 'description'>): boolean =>
  getItemFamily(item) !== null;

// Unit price for a given tier quantity, before line discount.
export const getTierUnitPrice = (basePrice: number, qty: number): number => {
  const mult = TIER_MULTIPLIERS[qty];
  return mult != null ? basePrice * mult : basePrice;
};

// Unit price for a tier after the line discount (group/family aware).
export const getTierNetUnitPrice = (item: LineItem, qty: number): number => {
  const mult = getItemMultipliers(item)[qty];
  const base = mult != null ? item.unitPrice * mult : item.unitPrice;
  return base * (1 - (item.discountPercent || 0) / 100);
};

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

// Lead time to show for a given quantity row (falls back to the line lead time).
export const getTierLeadTime = (item: LineItem, qty: number): string =>
  (item.tierLeadTimes?.[String(qty)] || '').trim() || (item.leadTime || '').trim() || '—';

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

// Total for the row's own quantity (MOQ row), regardless of the chosen tier.
export const calculateMoqLineTotal = (item: LineItem): number => {
  const gross = Number(item.moq) * item.unitPrice;
  return gross - gross * ((item.discountPercent || 0) / 100);
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
