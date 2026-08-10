ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES public.customer_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_accounts_parent_account_id_idx
  ON public.customer_accounts(parent_account_id);