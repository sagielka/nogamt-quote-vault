-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own archived quotations" ON public.archived_quotations;

-- Create new policy: users see their own, admins see all
CREATE POLICY "Users can view their own archived quotations or admins see all"
ON public.archived_quotations
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);