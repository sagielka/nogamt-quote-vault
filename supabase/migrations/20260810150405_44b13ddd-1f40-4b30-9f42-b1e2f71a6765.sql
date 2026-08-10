CREATE OR REPLACE FUNCTION public.is_approved_customer_for_company(_user_id uuid, _client_name text)
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
  ), fam AS (
    SELECT lower(btrim(ca.company_name)) AS company, lower(btrim(ca.email)) AS email
    FROM public.customer_accounts ca, root
    WHERE ca.status = 'approved'
      AND (ca.id = root.root_id OR ca.parent_account_id = root.root_id)
  ), names AS (
    SELECT company AS nm FROM fam WHERE company IS NOT NULL AND company <> ''
    UNION
    SELECT lower(btrim(c.name))
    FROM public.customers c, fam
    WHERE EXISTS (
      SELECT 1 FROM unnest(string_to_array(COALESCE(c.email, ''), ',')) AS e(addr)
      WHERE lower(btrim(e.addr)) = fam.email
    )
  )
  SELECT EXISTS (
    SELECT 1 FROM names WHERE nm = lower(btrim(COALESCE(_client_name, '')))
  )
$function$;

CREATE POLICY "Approved customers can view their company quotations"
ON public.quotations FOR SELECT TO authenticated
USING (public.is_approved_customer_for_company(auth.uid(), client_name));