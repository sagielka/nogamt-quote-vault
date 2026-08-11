CREATE OR REPLACE FUNCTION public.update_my_portal_account(_company_name text, _contact_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _company_name IS NULL OR btrim(_company_name) = '' THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;
  IF length(_company_name) > 200 OR length(COALESCE(_contact_name,'')) > 200 THEN
    RAISE EXCEPTION 'Value too long';
  END IF;

  UPDATE public.customer_accounts
     SET company_name = btrim(_company_name),
         contact_name = NULLIF(btrim(COALESCE(_contact_name,'')), '')
   WHERE user_id = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_portal_account(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_portal_account(text, text) TO authenticated;