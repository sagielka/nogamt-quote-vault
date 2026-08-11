CREATE TABLE public.message_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view read receipts"
  ON public.message_reads FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Users mark their own reads"
  ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

CREATE INDEX idx_message_reads_message ON public.message_reads(message_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;