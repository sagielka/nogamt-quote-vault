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
);

CREATE OR REPLACE FUNCTION public.is_approved_customer_for_email(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_accounts ca
    JOIN auth.users u ON u.id = ca.user_id
    WHERE ca.user_id = _user_id
      AND ca.status = 'approved'
      AND lower(ca.email) = lower(_email)
      AND lower(u.email) = lower(ca.email)
      AND u.email_confirmed_at IS NOT NULL
  )
$function$;