
CREATE POLICY "Authenticated can upload line item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'line-item-images');

CREATE POLICY "Authenticated can read line item images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'line-item-images');

CREATE POLICY "Authenticated can update line item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'line-item-images');

CREATE POLICY "Authenticated can delete line item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'line-item-images');
