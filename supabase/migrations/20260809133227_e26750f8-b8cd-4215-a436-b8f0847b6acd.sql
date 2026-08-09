
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','user','viewer')
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can view all quotations" ON public.quotations;
CREATE POLICY "Staff can view all quotations" ON public.quotations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
CREATE POLICY "Staff can view all customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view sent emails" ON public.sent_emails;
CREATE POLICY "Staff can view sent emails" ON public.sent_emails FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view email tracking" ON public.email_tracking;
CREATE POLICY "Staff can view email tracking" ON public.email_tracking FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view activity log" ON public.activity_log;
CREATE POLICY "Staff can view activity log" ON public.activity_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view quotation versions" ON public.quotation_versions;
CREATE POLICY "Staff can view quotation versions" ON public.quotation_versions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view recurring quotations" ON public.recurring_quotations;
CREATE POLICY "Staff can view recurring quotations" ON public.recurring_quotations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all archived quotations" ON public.archived_quotations;
CREATE POLICY "Staff can view archived quotations" ON public.archived_quotations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view email attachments" ON public.quotation_email_attachments;
CREATE POLICY "Staff can view email attachments" ON public.quotation_email_attachments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view portal tokens" ON public.customer_portal_tokens;
CREATE POLICY "Staff can view portal tokens" ON public.customer_portal_tokens FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
CREATE POLICY "Staff can view email templates" ON public.email_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
CREATE POLICY "Staff can view messages" ON public.messages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view cost overrides" ON public.product_cost_overrides;
CREATE POLICY "Staff can view cost overrides" ON public.product_cost_overrides FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update cost overrides" ON public.product_cost_overrides;
CREATE POLICY "Staff can update cost overrides" ON public.product_cost_overrides FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

DROP POLICY IF EXISTS "Authenticated users can add cost overrides" ON public.product_cost_overrides;
CREATE POLICY "Staff can add cost overrides" ON public.product_cost_overrides FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')));
