
CREATE TABLE public.email_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  email_type text NOT NULL DEFAULT 'quotation',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  read_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email tracking"
  ON public.email_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert tracking"
  ON public.email_tracking FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update tracking"
  ON public.email_tracking FOR UPDATE
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.email_tracking;
