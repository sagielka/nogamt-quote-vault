ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS is_account_admin boolean NOT NULL DEFAULT false;

-- Main contacts (root accounts) manage their own team by default
UPDATE public.customer_accounts SET is_account_admin = true WHERE parent_account_id IS NULL;