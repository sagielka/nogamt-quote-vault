# Approval email to portal customers

When an admin approves a customer account in the portal admin screen, the customer gets an email telling them their access is live.

## Email content

- Subject: "Your Noga MT price portal access is approved"
- Greeting by contact name (falls back to company name, then email prefix)
- Confirmation that the account is approved and which price list was assigned
- A button linking to the portal prices page (https://quote.noga-mt.com/#/prices)
- Note that they sign in with the email they registered with
- If they were granted team-admin rights, a line saying they can invite and manage colleagues
- Standard Noga signature styling (orange accent), BCC to sagi@noga.com like other outgoing mail

## Behaviour

- Sent only on the approve action (including the "create portal user" flow, which creates the account already approved).
- Sending failures never block the approval: the account is still approved and the admin sees a warning toast if the email could not go out.
- No email on revoke/reject.

## Technical details

- New edge function `supabase/functions/notify-portal-approval/index.ts`, following the existing `notify-portal-signup` pattern: validates the caller's JWT, checks the caller is staff/admin via `has_role`, loads the target `customer_accounts` row with the service role, and sends through Brevo using the existing `BREVO_API_KEY` secret.
- `src/components/CustomerAccountsAdmin.tsx`: after a successful approve in `confirmApprove` (and after the admin-created approved user in the create flow), invoke the function with the account id; surface a non-blocking warning toast on failure.
- Deploy the new function after creating it.
