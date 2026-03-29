
-- 1. Fix messages SELECT policy: change from 'public' to 'authenticated' role
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
CREATE POLICY "Authenticated users can view messages"
ON public.messages FOR SELECT TO authenticated
USING (true);

-- 2. Drop unnecessary anon INSERT policy on sent_emails (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role can insert sent emails" ON public.sent_emails;

-- 3. Fix email_tracking: drop overly permissive anon/authenticated UPDATE, replace with restricted policy
DROP POLICY IF EXISTS "Anon and authenticated can update tracking" ON public.email_tracking;

-- 4. Fix email_tracking: drop overly permissive anon/authenticated INSERT, keep only service role needs
DROP POLICY IF EXISTS "Anon and authenticated can insert tracking" ON public.email_tracking;
