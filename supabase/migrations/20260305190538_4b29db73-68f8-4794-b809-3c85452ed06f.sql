
-- Fix customers UPDATE policy: restrict to admins and users only
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Admins and users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'user'::app_role)
);

-- Fix customers DELETE policy: restrict to admins and users only
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
CREATE POLICY "Admins and users can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'user'::app_role)
);
