
-- =============================================
-- 1. Quotation Versions (for Quote Versioning)
-- =============================================
CREATE TABLE public.quotation_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  changed_by UUID NOT NULL,
  change_summary TEXT,
  items JSONB NOT NULL,
  notes TEXT,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_address TEXT,
  valid_until TIMESTAMPTZ NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotation versions"
ON public.quotation_versions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create versions"
ON public.quotation_versions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

CREATE INDEX idx_quotation_versions_quotation_id ON public.quotation_versions(quotation_id);
CREATE INDEX idx_quotation_versions_version_number ON public.quotation_versions(quotation_id, version_number);

-- =============================================
-- 2. Activity Log
-- =============================================
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity log"
ON public.activity_log FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert activity log"
ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- =============================================
-- 3. Customer Portal Tokens
-- =============================================
CREATE TABLE public.customer_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  client_response TEXT,
  client_response_at TIMESTAMPTZ,
  client_comment TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view portal tokens"
ON public.customer_portal_tokens FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create portal tokens"
ON public.customer_portal_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update portal tokens"
ON public.customer_portal_tokens FOR UPDATE TO authenticated
USING (true);

-- Public read for the portal page (via token lookup)
CREATE POLICY "Public can read active tokens by token value"
ON public.customer_portal_tokens FOR SELECT TO anon
USING (is_active = true AND expires_at > now());

CREATE INDEX idx_portal_tokens_token ON public.customer_portal_tokens(token);
CREATE INDEX idx_portal_tokens_quotation ON public.customer_portal_tokens(quotation_id);

-- =============================================
-- 4. Recurring Quotations
-- =============================================
CREATE TABLE public.recurring_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_address TEXT,
  template_items JSONB NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC DEFAULT 0,
  notes TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recurring quotations"
ON public.recurring_quotations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create recurring quotations"
ON public.recurring_quotations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and users can update recurring quotations"
ON public.recurring_quotations FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Admins and users can delete recurring quotations"
ON public.recurring_quotations FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- Allow anon read for quotation public portal
CREATE POLICY "Public can read quotations by id"
ON public.quotations FOR SELECT TO anon
USING (true);
