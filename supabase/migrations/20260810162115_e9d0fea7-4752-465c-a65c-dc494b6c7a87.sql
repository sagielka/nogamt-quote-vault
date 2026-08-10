DROP POLICY IF EXISTS "Anyone can view product media" ON public.product_media;
CREATE POLICY "Authenticated users can view product media"
ON public.product_media FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.product_media FROM anon;