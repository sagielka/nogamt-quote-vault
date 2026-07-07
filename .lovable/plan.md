## Problem

In the generated PDF, a thin horizontal line runs through the middle of every line item's text (SKU, description, LT, MOQ, Unit, Disc %, Net columns). It looks like a strikethrough on every row.

## Root cause

In `src/lib/pdf-generator.ts` the row separator is drawn at the bottom of each row, and then `y` is only advanced by `sepGap` mm before the next row's text is drawn with its baseline at that new `y`. Because `pdf.text()` uses the baseline as the anchor, the text ascender extends ~2.5–2.8 mm above the baseline (for 7–8 pt).

When the auto-fit picks a denser preset (`sepGap` of 1.5 or 1 mm), the separator ends up inside the next row's text — visually cutting through it.

## Fix

Adjust `src/lib/pdf-generator.ts` in the line-items rendering block so the separator sits cleanly between rows:

1. Increase `sepGap` in every density preset to at least ~3 mm so the separator is always below one row's descender and above the next row's ascender. Rebalance `gapAfter` / `lineH` slightly so total density is preserved for the auto-fit path.
2. Draw the separator in the middle of the inter-row gap instead of flush at the end of the row: after `y += rowHeight + gapAfter`, advance `y` by `sepGap / 2`, draw the line, then advance `y` by the remaining `sepGap / 2`. This guarantees the line is centered in the whitespace between rows regardless of preset.

No other files change. Behavior of totals, notes, page-break logic, and thumbnails is untouched.

## Verification

Regenerate the same quotation PDF (30 line items, 2 pages) and confirm:
- No line crosses through any row's text on either page.
- Rows still fit within 2 pages (auto-fit still works).
- Totals block and footer positions look unchanged.
