## Update Product Catalog from New Master Price List

The uploaded file `NOGA MT 2026-04 MASTER PRICE LIST.xlsx` has **389 rows** across one sheet with columns: SKU, Description, EURO, DOLLAR, NOGA BV EURO, NOGA TOOLS SHEKEL, CHINA DOLLAR. Prefix breakdown: UF (218), UB (108), UC (36), UX (21), US (6 placeholders).

### What I'll change

1. **`src/data/product-catalog.ts` → `staticCatalogProducts`**
   - Regenerate the array from the uploaded Excel. Currently 363 entries → will become 383 entries (all rows except the 6 `US…` template placeholders like `US2…`, which are not real SKUs).
   - Each price rounded to 2 decimals to match existing formatting.
   - UC rows from the file are included as static; their prices already match the existing `UC_SKU_PRICES` tier table, so dynamic UC generation continues to work for any UC SKUs not in the file.

2. **Verified — no changes needed:**
   - The `US_SKU_PRICES` and `UC_SKU_PRICES` tier tables (the 2-7 / A-G letter pricing) match the new file exactly.
   - Currency conversion rates, helpers, and UI components remain untouched.

### Out of scope
- No changes to US/UC dynamic pricing logic, currency rates, or any UI.
- No changes to the GitHub-hosted `uspot-inserts.json` / `uchamf-inserts.json` fallback data (descriptions still flow from there for SKUs not in the master list).

### Technical notes
- Will generate the TS array with a one-off Python script reading the xlsx, then paste the result into `staticCatalogProducts`.
- Existing dedupe logic (static wins over dynamic) ensures no duplicates.
