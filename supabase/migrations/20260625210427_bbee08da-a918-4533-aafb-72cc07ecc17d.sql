
-- Add UPDATE policy for email-attachments
CREATE POLICY "Users can update own email attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add UPDATE policy for quotation-attachments
CREATE POLICY "Users can update their attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quotation-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'quotation-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Tighten line-item-images policies with folder-ownership checks
DROP POLICY IF EXISTS "Authenticated can read line item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload line item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update line item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete line item images" ON storage.objects;

CREATE POLICY "Users can read own line item images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'line-item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own line item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'line-item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own line item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'line-item-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'line-item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own line item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'line-item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
