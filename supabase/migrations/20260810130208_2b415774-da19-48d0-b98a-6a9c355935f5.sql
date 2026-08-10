CREATE TABLE public.product_media (
  sku text PRIMARY KEY,
  image_path text,
  model_path text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product media"
ON public.product_media FOR SELECT
USING (true);

CREATE POLICY "Admins can insert product media"
ON public.product_media FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product media"
ON public.product_media FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product media"
ON public.product_media FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_media_updated_at
BEFORE UPDATE ON public.product_media
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();