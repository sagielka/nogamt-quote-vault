
-- Fix: customer_portal_tokens UPDATE policy - restrict to admins/users
DROP POLICY "Authenticated users can update portal tokens" ON public.customer_portal_tokens;
CREATE POLICY "Admins and users can update portal tokens"
ON public.customer_portal_tokens FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- Fix: quotations anon SELECT - only allow if there's an active portal token
DROP POLICY "Public can read quotations by id" ON public.quotations;
CREATE POLICY "Public can read quotations with active portal token"
ON public.quotations FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.customer_portal_tokens t
    WHERE t.quotation_id = quotations.id
    AND t.is_active = true
    AND t.expires_at > now()
  )
);
