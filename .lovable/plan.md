## Goal
On a new quotation, when an existing customer is picked and the user then edits the email field, treat the new email as a quote-only override: keep the customer card's primary details intact, append the new email to the customer's stored email list (comma-separated), and save the quote with the new email.

## Behavior
- If the entered email already exists in the selected customer's emails (comma-split, case-insensitive), do nothing extra — just use it for the quote.
- If it's a new email and the customer was selected from the picker:
  - Append the new email to the customer's `email` field as `existing, newEmail` (respecting the 500-char cap from memory; if it would overflow, skip the append and just use it on the quote).
  - Do NOT change the customer's name/address.
  - Use the new email as the quote's `clientEmail`.
- If no existing customer was selected (free-typed), keep current behavior (create/update by name/email match).

## Technical changes (single file: `src/components/quotation/QuotationForm.tsx`)
1. In `saveCustomerToDatabase`, when `selectedCustomerId` is set:
   - Fetch the existing customer's `email` (not just `id`).
   - Split on commas; if `clientEmail` is already in the list → update only `name`/`address` (leave email untouched).
   - If `clientEmail` is new → build `appendedEmails = [...existing, clientEmail].join(', ')`, guard against 500-char limit, and update with the appended email string. Name/address stay the user-edited values but email is the appended list, not the new email alone.
2. Suppress the duplicate `customers` upsert inside `useQuotations.addQuotation` / `updateQuotation` for this flow so it doesn't overwrite the email back to a single value. Simplest: pass a flag (e.g. `skipCustomerSync: true`) on the form data when submitting from `QuotationForm` (which already handles the sync itself via `saveCustomerToDatabase`), and have the hook skip its upsert when present.
3. The quote itself already stores whatever is in `clientEmail`, so the new email is automatically used for the quotation — no extra change needed there.

## Out of scope
- No UI changes to the email input.
- No changes to the customer edit dialog (explicit edits there still overwrite as today).
- No schema changes.
