
DROP POLICY "Service role can insert tracking" ON public.email_tracking;
DROP POLICY "Service role can update tracking" ON public.email_tracking;

-- Only allow inserts/updates via service role (edge functions use service role key)
CREATE POLICY "Anon and authenticated can insert tracking"
  ON public.email_tracking FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and authenticated can update tracking"
  ON public.email_tracking FOR UPDATE
  TO anon, authenticated
  USING (true);
