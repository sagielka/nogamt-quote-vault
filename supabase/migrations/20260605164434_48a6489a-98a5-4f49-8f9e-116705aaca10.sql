
-- 1) Lock down customer portal token anon access
DROP POLICY IF EXISTS "Public can read active tokens by token value" ON public.customer_portal_tokens;
DROP POLICY IF EXISTS "Public can read quotations with active portal token" ON public.quotations;

-- Secure RPC: fetch portal data by token value
CREATE OR REPLACE FUNCTION public.get_portal_data(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.customer_portal_tokens%ROWTYPE;
  v_quote public.quotations%ROWTYPE;
BEGIN
  SELECT * INTO v_token
  FROM public.customer_portal_tokens
  WHERE token = _token
    AND is_active = true
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_quote
  FROM public.quotations
  WHERE id = v_token.quotation_id;

  RETURN jsonb_build_object(
    'token', to_jsonb(v_token),
    'quotation', to_jsonb(v_quote)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_data(uuid) TO anon, authenticated;

-- Secure RPC: submit client response by token value
CREATE OR REPLACE FUNCTION public.submit_portal_response(
  _token uuid,
  _response text,
  _comment text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  IF _response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;

  UPDATE public.customer_portal_tokens
     SET client_response = _response,
         client_response_at = now(),
         client_comment = _comment
   WHERE token = _token
     AND is_active = true
     AND expires_at > now()
     AND client_response IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_portal_response(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portal_response(uuid, text, text) TO anon, authenticated;

-- 2) Restrict email-attachments storage bucket to per-user folders
DROP POLICY IF EXISTS "Authenticated users can read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload email attachments" ON storage.objects;

CREATE POLICY "Users can read own email attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own email attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own email attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
