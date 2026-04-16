
-- Drop and recreate storage policies for email-attachments to allow any authenticated user
DROP POLICY IF EXISTS "Users can upload own email attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "Users can read own email attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read email attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "Users can delete own email attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete email attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-attachments');
