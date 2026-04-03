-- Drop existing overly permissive policies for email-attachments bucket
DROP POLICY IF EXISTS "Users can read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email attachments" ON storage.objects;

-- Create ownership-scoped policies for email-attachments bucket
CREATE POLICY "Users can read own email attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own email attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own email attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);