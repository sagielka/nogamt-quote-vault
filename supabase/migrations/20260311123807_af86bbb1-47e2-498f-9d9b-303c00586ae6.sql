
CREATE TABLE public.sent_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'custom',
  attachment_names TEXT[] DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sent emails"
ON public.sent_emails
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sent emails"
ON public.sent_emails
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert sent emails"
ON public.sent_emails
FOR INSERT
TO anon
WITH CHECK (true);
