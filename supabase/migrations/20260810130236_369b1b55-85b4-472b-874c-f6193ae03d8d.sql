CREATE POLICY "Signed-in users can view product media files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-media');

CREATE POLICY "Admins can upload product media files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product media files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product media files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));