CREATE TABLE public.customer_price_list_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  previous_price_list text,
  new_price_list text,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.customer_price_list_history TO authenticated;
GRANT ALL ON public.customer_price_list_history TO service_role;

ALTER TABLE public.customer_price_list_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view price list history"
ON public.customer_price_list_history
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert price list history"
ON public.customer_price_list_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_cplh_customer ON public.customer_price_list_history (customer_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_customer_price_list_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.price_list IS NOT NULL THEN
      INSERT INTO public.customer_price_list_history (customer_id, previous_price_list, new_price_list, changed_by)
      VALUES (NEW.id, NULL, NEW.price_list, auth.uid());
    END IF;
  ELSIF NEW.price_list IS DISTINCT FROM OLD.price_list THEN
    INSERT INTO public.customer_price_list_history (customer_id, previous_price_list, new_price_list, changed_by)
    VALUES (NEW.id, OLD.price_list, NEW.price_list, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_customer_price_list_change
AFTER INSERT OR UPDATE OF price_list ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.log_customer_price_list_change();

INSERT INTO public.customer_price_list_history (customer_id, previous_price_list, new_price_list, changed_by, changed_at)
SELECT id, NULL, price_list, user_id, updated_at FROM public.customers WHERE price_list IS NOT NULL;