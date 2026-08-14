# Fix: NOGA BV shown as having orders

## What the data actually says

Checked every NOGA BV quotation in the database:

- 2 quotations are `sent`
- 18 quotations are `finished`
- **0 quotations are `accepted`**
- **None** of them has any recorded ordered line items or ordered quantities

So NOGA BV has no confirmed orders. The portal is wrong.

## Why the portal shows orders

The customer portal statistics treat both `accepted` **and** `finished` as "order placed". Since almost every NOGA BV quote is marked `finished`, the portal counts them all as orders — which is where the "Ordered value 18,492.33 EUR" and the conversion rate come from.

## The fix

In the portal statistics:

- Count a quotation as an order only when its status is `accepted`, or when it is `finished` **and** has recorded ordered items (a real confirmed order).
- Everything else (`draft`, `sent`, plain `finished`) counts as quoted value only.

Result for NOGA BV: Orders placed = 0, Ordered value = no orders yet, conversion 0%, average order value shown as an em dash. Total quoted value stays unchanged.

## Technical detail

`src/components/customer-portal/PortalStats.tsx` — replace the `ORDER_STATUSES` constant check with an `isOrder(q)` helper used by the KPI cards, the monthly trend chart, and the average-order-value calculation.
