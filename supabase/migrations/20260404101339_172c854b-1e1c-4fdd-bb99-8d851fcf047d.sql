
-- Backfill activity log with "created" entries for all existing quotations
INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_label, details, created_at)
SELECT 
  user_id,
  'created',
  'quotation',
  id,
  quote_number,
  jsonb_build_object('client_name', client_name, 'status', status),
  created_at
FROM public.quotations
ORDER BY created_at ASC;

-- Backfill "status_changed" entries for quotations with non-default statuses
INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_label, details, created_at)
SELECT 
  user_id,
  'status_changed',
  'quotation',
  id,
  quote_number,
  jsonb_build_object('client_name', client_name, 'new_status', status),
  updated_at
FROM public.quotations
WHERE status IS NOT NULL AND status != 'sent'
ORDER BY updated_at ASC;

-- Backfill "archived" entries from archived_quotations
INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_label, details, created_at)
SELECT 
  archived_by,
  'archived',
  'quotation',
  original_id,
  quote_number,
  jsonb_build_object('client_name', client_name, 'status', status),
  archived_at
FROM public.archived_quotations
ORDER BY archived_at ASC;

-- Backfill "created" entries for archived quotations (original creation)
INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_label, details, created_at)
SELECT 
  user_id,
  'created',
  'quotation',
  original_id,
  quote_number,
  jsonb_build_object('client_name', client_name, 'status', status),
  created_at
FROM public.archived_quotations
ORDER BY created_at ASC;
