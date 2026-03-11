
-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload email attachments
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to read email attachments
CREATE POLICY "Authenticated users can read email attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-attachments');

-- Allow authenticated users to delete their email attachments
CREATE POLICY "Authenticated users can delete email attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-attachments');

-- Create table to track attached outlook emails per quotation
CREATE TABLE public.quotation_email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email attachments"
ON public.quotation_email_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert email attachments"
ON public.quotation_email_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email attachments"
ON public.quotation_email_attachments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
