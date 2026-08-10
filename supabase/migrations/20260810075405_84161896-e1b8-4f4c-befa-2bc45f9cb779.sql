DROP POLICY IF EXISTS "Admins can update customer accounts" ON public.customer_accounts;
CREATE POLICY "Portal managers can update customer accounts"
  ON public.customer_accounts FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'price_portal'))
  WITH CHECK (public.has_permission(auth.uid(), 'price_portal'));

DROP POLICY IF EXISTS "Customers can view their own account" ON public.customer_accounts;
CREATE POLICY "Customers and portal managers can view accounts"
  ON public.customer_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'price_portal'));