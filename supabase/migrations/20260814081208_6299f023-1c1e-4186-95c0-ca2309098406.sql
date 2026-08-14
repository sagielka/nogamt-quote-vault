DROP POLICY IF EXISTS "Customers can create their own pending account" ON public.customer_accounts;

CREATE POLICY "Customers can create their own pending account"
ON public.customer_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND price_list IS NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND coalesce(is_account_admin, false) = false
);