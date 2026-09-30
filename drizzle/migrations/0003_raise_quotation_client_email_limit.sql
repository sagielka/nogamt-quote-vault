ALTER TABLE public.quotations DROP CONSTRAINT client_email_length;
ALTER TABLE public.quotations ADD CONSTRAINT client_email_length CHECK (length(client_email) <= 2000);