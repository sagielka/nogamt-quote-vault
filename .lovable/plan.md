## Goal

The line-items table should have **one** quantity column whose *header* is a dropdown letting you pick whether this quote uses **MOQ** or **QTY**. The cell values go back to plain number inputs (no per-row dropdown).

## Changes

1. **Database**: add a `quantity_label` text column on `quotations` (default `'MOQ'`), so the choice is saved per quote.

2. **Form header** (`QuotationForm.tsx`): replace the static `MOQ` header cell with a small dropdown (MOQ / QTY) styled to fit the grid header. Changing it updates the quote field only — the underlying per-line `moq` numbers are untouched.

3. **Line item cells** (`LineItemWithSku.tsx`): revert the MOQ field to a plain number input (drop the `QuantityInput` chevron/preset popover there). Placeholder follows the chosen label.

4. **Order picker** (`OrderLinePickerDialog.tsx`): keep the ordered-quantity field, also reverted to a plain number input for consistency.

5. **Read-only surfaces**: `QuotationPreview.tsx`, `pdf-generator.ts`, `CustomerPortal.tsx`, and `VersionHistory.tsx` render the chosen label instead of the hardcoded "MOQ". Existing quotes without a value fall back to "MOQ".

6. **Types & data flow**: add `quantityLabel` to the quotation type and map it in `useQuotations.ts` (load/save), plus recurring-quote templates if they carry it.

## Notes

- `QuantityInput.tsx` becomes unused and will be removed.
- No change to totals, pricing, or cost logic.
