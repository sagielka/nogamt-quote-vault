create policy "Staff can upload voice messages"
on storage.objects for insert to authenticated
with check (bucket_id = 'voice-messages' and public.is_staff(auth.uid()));

create policy "Staff can read voice messages"
on storage.objects for select to authenticated
using (bucket_id = 'voice-messages' and public.is_staff(auth.uid()));

create policy "Owners can delete voice messages"
on storage.objects for delete to authenticated
using (bucket_id = 'voice-messages' and owner = auth.uid());