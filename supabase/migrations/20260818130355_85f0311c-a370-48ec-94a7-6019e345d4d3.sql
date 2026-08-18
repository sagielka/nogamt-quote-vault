CREATE TABLE public.portal_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  event text NOT NULL,
  details jsonb,
  path text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.portal_activity TO authenticated;
GRANT ALL ON public.portal_activity TO service_role;

ALTER TABLE public.portal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own portal activity"
ON public.portal_activity FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own portal activity"
ON public.portal_activity FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all portal activity"
ON public.portal_activity FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'price_portal'));

CREATE INDEX idx_portal_activity_user_created ON public.portal_activity (user_id, created_at DESC);
CREATE INDEX idx_portal_activity_created ON public.portal_activity (created_at DESC);