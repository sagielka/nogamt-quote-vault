CREATE TABLE public.app_settings (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  force_update_enabled BOOLEAN NOT NULL DEFAULT false,
  force_update_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read app settings"
ON public.app_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can create app settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES ('global');