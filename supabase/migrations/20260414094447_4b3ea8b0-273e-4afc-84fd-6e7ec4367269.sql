
ALTER TABLE public.sent_emails ADD COLUMN recalled_at timestamp with time zone DEFAULT NULL;

CREATE POLICY "Authenticated users can update recalled_at on sent emails"
ON public.sent_emails
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
