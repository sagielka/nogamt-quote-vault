# Show standard Euro price alongside Noga BV prices

For portal accounts assigned the **Noga BV Euro Prices** list only, display the standard Euro list price next to each BV price. All other price lists stay exactly as they are today.

## What changes

- **Price list tab (table view):** an extra right-aligned column "Euro price" shown only for BV accounts, next to the existing unit price (which stays labelled as the BV price).
- **Price list tab (slide/cards view):** a smaller secondary line under the big BV price, e.g. "Euro list €12.40".
- **Quantity price breaks:** unchanged — tier prices remain BV-based only.
- **New items tab:** same secondary Euro price next to the BV price.
- **Excel download:** an extra "Euro price" column for BV accounts.
- If an item has no standard Euro price in the catalog, the cell shows "—".

Both currencies are EUR, so no conversion or exchange rate is involved — the Euro value comes straight from the catalog's EURO price field.

## Technical notes

- Gate everything on `priceList === 'NOGA_BV_EURO'` in `src/components/customer-portal/PortalContent.tsx`; custom (uploaded) price lists are unaffected.
- The comparison value is `product.prices.EURO` from `getProductCatalog()` (and `euro` from `catalog_prices` in `PortalNewItems.tsx`).
- Table grid template changes from `[2rem_10rem_1fr_10rem]` to add a 10rem column when the BV flag is on; header cells and `colSpan` adjusted accordingly.
- No database, RLS, or edge function changes.
