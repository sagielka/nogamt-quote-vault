GRANT SELECT ON public.product_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;