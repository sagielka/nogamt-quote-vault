
-- Add reminder tracking to quotations
ALTER TABLE public.quotations ADD COLUMN reminder_sent_at timestamp with time zone DEFAULT NULL;

-- Create unsubscribed emails table
CREATE TABLE public.unsubscribed_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  unsubscribed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Anyone can check unsubscribe status (needed by edge function)
CREATE POLICY "Public can read unsubscribed emails"
  ON public.unsubscribed_emails FOR SELECT USING (true);

-- Public insert so the unsubscribe link works without auth
CREATE POLICY "Public can insert unsubscribed emails"
  ON public.unsubscribed_emails FOR INSERT WITH CHECK (true);
