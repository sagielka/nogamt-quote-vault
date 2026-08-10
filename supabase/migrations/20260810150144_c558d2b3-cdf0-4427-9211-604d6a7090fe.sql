CREATE OR REPLACE FUNCTION public.is_approved_customer_for_email(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT ca.id, ca.parent_account_id
    FROM public.customer_accounts ca
    JOIN auth.users u ON u.id = ca.user_id
    WHERE ca.user_id = _user_id
      AND ca.status = 'approved'
      AND lower(u.email) = lower(ca.email)
      AND u.email_confirmed_at IS NOT NULL
  ), root AS (
    SELECT COALESCE(parent_account_id, id) AS root_id FROM me
  ), family AS (
    SELECT lower(ca.email) AS email
    FROM public.customer_accounts ca, root
    WHERE ca.status = 'approved'
      AND (ca.id = root.root_id OR ca.parent_account_id = root.root_id)
  )
  SELECT EXISTS (
    SELECT 1
    FROM family f,
         unnest(string_to_array(COALESCE(_email, ''), ',')) AS e(addr)
    WHERE lower(btrim(e.addr)) = f.email
  )
$function$;