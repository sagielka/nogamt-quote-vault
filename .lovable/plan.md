
## Phase 1: Database Foundation
Add new tables and columns needed for all features:
- **`quotation_versions`** table — stores version history (snapshot of items, notes, etc.)
- **`activity_log`** table — tracks who changed what and when
- **`cost_price`** field on line items (stored in quotations JSON)
- **`recurring_quotations`** table — schedule + template for auto-generated quotes
- **`customer_portal_tokens`** table — secure tokens for public quote access

## Phase 2: Profit Margin Calculator
- Add cost price field to each line item in the quotation form
- Calculate and display margin % and total profit alongside totals
- Show margins in the quotation preview (optional toggle)

## Phase 3: Dashboard Analytics
- New Dashboard page with charts (using existing Recharts dependency)
- Revenue trends over time, conversion rates (sent→accepted), quotes per month
- Top customers by revenue
- Summary stats cards (total quotes, total revenue, avg quote value)

## Phase 4: Quote Versioning
- Auto-save a version snapshot each time a quotation is edited
- Version history panel showing v1, v2, v3 with timestamps and who made changes
- Ability to view/restore previous versions

## Phase 5: Activity Log
- Log all CRUD operations on quotations (create, edit, status change, delete)
- Viewable log per quotation and a global activity feed
- Shows user, action, timestamp, and key changes

## Phase 6: Bulk Actions
- Multi-select checkboxes on quotation list
- Toolbar appears with options: Archive, Change Status, Export as PDF
- Select all / deselect all functionality

## Phase 7: Customer Portal
- Generate secure, expiring public links for quotations
- Public page showing quote details (read-only) with Accept/Decline buttons
- Edge function to validate tokens and handle responses

## Phase 8: Recurring Quotations
- UI to set up recurring schedules (weekly/monthly/quarterly) for a customer
- Edge function + cron job to auto-generate quotes from templates
- Management view to see/edit/disable recurring schedules

Each phase will be implemented and testable independently.
