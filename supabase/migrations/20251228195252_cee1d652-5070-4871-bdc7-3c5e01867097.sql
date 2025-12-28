-- Create storage bucket for quotation attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('quotation-attachments', 'quotation-attachments', true);

-- Allow public read access
CREATE POLICY "Anyone can view attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'quotation-attachments');

-- Allow public upload
CREATE POLICY "Anyone can upload attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'quotation-attachments');

-- Allow public delete
CREATE POLICY "Anyone can delete attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'quotation-attachments');