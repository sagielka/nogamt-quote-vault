
## Goal
When sending a reminder to multiple recipients, greet each person by their own name instead of sending one shared email with the quotation's client name.

## Current behavior
`supabase/functions/send-quotation-email/index.ts` puts all reminder recipients into a single Brevo `to` array and uses one `htmlContent` with `Dear ${clientName}` — so every recipient sees the same generic greeting.

## Plan

1. **Frontend (reminder trigger)** — where reminders are dispatched, pass a `recipientsWithNames: [{ email, name }]` array alongside/instead of `recipients: string[]`. Names come from the customer record (customers table already stores multiple emails; pair each email with the customer contact name where available, fall back to the email's local-part, then to `clientName`).

2. **Edge function `send-quotation-email`**
   - Extend request schema to accept `recipientsWithNames?: { email: string; name?: string }[]` (keep `recipients` for backward compatibility).
   - For reminders: instead of one Brevo call with N recipients, loop and send one email per recipient. Each call:
     - `to: [{ email, name }]`
     - Greeting rendered as `Dear ${recipientName}` (fallback to `clientName` if name missing).
     - Same CC (handler), same attachment, same tracking pixel logic (one tracking row per recipient — already the pattern).
   - Keep unsubscribe filtering, 7-day cooldown, and `reminder_sent_at` update (set once after the batch).
   - Save one `sent_emails` row per recipient (or one aggregated row — keep current aggregated behavior but list all recipients).

3. **Non-reminder path** — unchanged (already single recipient using `clientName`).

## Technical notes
- Name resolution priority: explicit `name` from payload → capitalized local-part of email → `clientName`.
- Preserve existing cooldown grace window so the per-recipient loop doesn't trip the 7-day guard mid-batch.
- No DB schema changes required.

## Files
- `supabase/functions/send-quotation-email/index.ts`
- Reminder dispatch site in the frontend (locate in `useQuotations.ts` / reminder UI component) to pass names.
