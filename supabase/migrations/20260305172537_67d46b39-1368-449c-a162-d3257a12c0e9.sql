
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can read unsubscribed emails" ON public.unsubscribed_emails;

-- Create a restricted SELECT policy for admins only
CREATE POLICY "Only admins can read unsubscribed emails"
ON public.unsubscribed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
