CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all templates (shared across team)
CREATE POLICY "Authenticated users can view email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (true);

-- Users can create their own templates
CREATE POLICY "Users can create email templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own email templates"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);