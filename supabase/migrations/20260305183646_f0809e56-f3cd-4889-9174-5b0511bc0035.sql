
-- Drop overly permissive UPDATE and DELETE policies
DROP POLICY IF EXISTS "Authenticated users can update quotations" ON public.quotations;
DROP POLICY IF EXISTS "Authenticated users can delete quotations" ON public.quotations;

-- Only admins and users (not viewers) can update quotations
CREATE POLICY "Admins and users can update quotations"
ON public.quotations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'user'::app_role)
);

-- Only admins and users (not viewers) can delete quotations
CREATE POLICY "Admins and users can delete quotations"
ON public.quotations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'user'::app_role)
);
