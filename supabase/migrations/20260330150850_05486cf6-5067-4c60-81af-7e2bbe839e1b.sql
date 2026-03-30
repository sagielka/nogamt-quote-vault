
DROP POLICY IF EXISTS "Admins and users can delete quotations" ON public.quotations;

CREATE POLICY "Users can delete own quotations, admins can delete any"
ON public.quotations
FOR DELETE
TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));
