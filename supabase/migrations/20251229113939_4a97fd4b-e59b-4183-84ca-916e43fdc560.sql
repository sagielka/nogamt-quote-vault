-- Fix 1: Make storage bucket private and add secure policies
UPDATE storage.buckets 
SET public = false 
WHERE id = 'quotation-attachments';

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete attachments" ON storage.objects;

-- Create authenticated user policies with ownership
CREATE POLICY "Authenticated users can upload their attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotation-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 3: Create quotations table to replace localStorage storage
CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quote_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_address TEXT,
  items JSONB NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT client_name_length CHECK (length(client_name) <= 200),
  CONSTRAINT client_email_length CHECK (length(client_email) <= 255),
  CONSTRAINT client_address_length CHECK (length(client_address) <= 500),
  CONSTRAINT notes_length CHECK (length(notes) <= 2000)
);

-- Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- RLS policies for quotations
CREATE POLICY "Users can view their own quotations"
ON public.quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quotations"
ON public.quotations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotations"
ON public.quotations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotations"
ON public.quotations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_quotations_updated_at
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add database constraints to customers table for input validation
ALTER TABLE public.customers 
ADD CONSTRAINT customers_name_length CHECK (length(name) <= 200);

ALTER TABLE public.customers 
ADD CONSTRAINT customers_email_length CHECK (length(email) <= 255);

ALTER TABLE public.customers 
ADD CONSTRAINT customers_address_length CHECK (length(address) <= 500);