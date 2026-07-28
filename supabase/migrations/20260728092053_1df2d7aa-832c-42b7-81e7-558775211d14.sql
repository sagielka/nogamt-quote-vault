CREATE TABLE public.product_cost_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  cost_usd numeric NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.product_cost_overrides TO authenticated;
GRANT ALL ON public.product_cost_overrides TO service_role;

ALTER TABLE public.product_cost_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cost overrides"
ON public.product_cost_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can add cost overrides"
ON public.product_cost_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update cost overrides"
ON public.product_cost_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Only admins can delete cost overrides"
ON public.product_cost_overrides FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_cost_overrides_updated_at
BEFORE UPDATE ON public.product_cost_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();