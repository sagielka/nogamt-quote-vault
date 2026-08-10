CREATE TABLE public.app_version_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version TEXT NOT NULL,
  previous_version TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.app_version_events TO authenticated;
GRANT ALL ON public.app_version_events TO service_role;

ALTER TABLE public.app_version_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record their own version events"
ON public.app_version_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own version events"
ON public.app_version_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all version events"
ON public.app_version_events FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE INDEX idx_app_version_events_created_at ON public.app_version_events (created_at DESC);