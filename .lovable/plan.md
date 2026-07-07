## Problem
Discounts don't affect displayed profit margins. Both the per-line margin and the summary margin ignore discount inputs.

- **Per-line margin** (`LineItemWithSku.tsx` ~L547): uses `(unitPrice - costPrice) / unitPrice`, ignoring the line's `discountPercent`.
- **Summary margin** (`QuotationForm.tsx` ~L975): uses raw `subtotal` (via `calculateSubtotal`, which already applies line discounts — good), but does NOT subtract the global `discountValue` / `discountType`, so quote-level discounts don't reduce profit.

## Fix

1. **Per-line margin** — compute against the discounted unit price:
   ```
   netUnit = unitPrice * (1 - discountPercent/100)
   margin  = (netUnit - costPrice) / netUnit * 100
   ```
   Color threshold logic unchanged.

2. **Summary margin** — subtract global discount from revenue:
   ```
   netRevenue = subtotal - calculateDiscount(subtotal, discountType, discountValue)
   profit     = netRevenue - totalCost
   margin     = profit / netRevenue * 100
   ```
   Label "Total Cost" and "Profit" rows unchanged; only the numbers change. Tax is excluded from margin (tax is not revenue).

3. **Analytics** (`QuotationStats.tsx` per-quote / per-customer / monthly margins) — apply the same net-revenue formula so dashboard figures stay consistent with the form.

No schema, backend, or PDF changes.

## Files touched
- `src/components/quotation/LineItemWithSku.tsx` — line-margin formula
- `src/components/quotation/QuotationForm.tsx` — summary margin block
- `src/components/quotation/QuotationStats.tsx` — analytics revenue calc
