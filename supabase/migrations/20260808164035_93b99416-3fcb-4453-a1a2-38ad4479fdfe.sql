CREATE TABLE public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  company_name text,
  contact_name text,
  status text NOT NULL DEFAULT 'pending',
  price_list text,
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_status_check CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT customer_accounts_price_list_check CHECK (price_list IS NULL OR price_list IN ('EURO','DOLLAR','SHEKEL','NOGA_BV_EURO','CHINA_DOLLAR'))
);

GRANT SELECT, INSERT, UPDATE ON public.customer_accounts TO authenticated;
GRANT ALL ON public.customer_accounts TO service_role;

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own account"
  ON public.customer_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can create their own pending account"
  ON public.customer_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND price_list IS NULL);

CREATE POLICY "Admins can update customer accounts"
  ON public.customer_accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customer_accounts_email ON public.customer_accounts (lower(email));

CREATE OR REPLACE FUNCTION public.get_customer_price_list(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT price_list FROM public.customer_accounts
  WHERE user_id = _user_id AND status = 'approved'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_approved_customer_for_email(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_accounts
    WHERE user_id = _user_id
      AND status = 'approved'
      AND lower(email) = lower(_email)
  )
$$;

CREATE POLICY "Approved customers can view their own quotations"
  ON public.quotations FOR SELECT TO authenticated
  USING (public.is_approved_customer_for_email(auth.uid(), client_email));