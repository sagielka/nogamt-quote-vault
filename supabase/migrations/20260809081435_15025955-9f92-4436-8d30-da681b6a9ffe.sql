CREATE TABLE public.custom_price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  source_file text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_price_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES public.custom_price_lists(id) ON DELETE CASCADE,
  sku text NOT NULL,
  description text,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cpli_list ON public.custom_price_list_items(list_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_price_lists TO authenticated;
GRANT ALL ON public.custom_price_lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_price_list_items TO authenticated;
GRANT ALL ON public.custom_price_list_items TO service_role;

ALTER TABLE public.custom_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage custom price lists" ON public.custom_price_lists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Assigned customers can view their list" ON public.custom_price_lists FOR SELECT TO authenticated
  USING (public.get_customer_price_list(auth.uid()) = 'custom:' || id::text);

CREATE POLICY "Staff manage custom price list items" ON public.custom_price_list_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Assigned customers can view their list items" ON public.custom_price_list_items FOR SELECT TO authenticated
  USING (public.get_customer_price_list(auth.uid()) = 'custom:' || list_id::text);

CREATE TRIGGER update_custom_price_lists_updated_at BEFORE UPDATE ON public.custom_price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();