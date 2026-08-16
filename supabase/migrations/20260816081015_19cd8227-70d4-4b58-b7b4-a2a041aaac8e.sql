BEGIN;

-- Allow more emails per customer record
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_email_length;
ALTER TABLE public.customers ADD CONSTRAINT customers_email_length CHECK (length(email) <= 1000);

-- Merge MSC duplicates into the main SID TOOL record
WITH all_msc_emails AS (
  SELECT DISTINCT trim(unnest(string_to_array(c.email, ','))) AS em
  FROM public.customers c
  WHERE c.id IN ('3560721a-3432-4413-ac35-114db9c5d386','dcc98c18-c619-47b5-b9f8-e12287d6dba6','020689c4-f428-45c7-bf96-9f82ac4d5742','a82acfe3-885d-425f-bb71-a8607535214b')
)
UPDATE public.customers
SET email = (
  SELECT string_agg(em, ',' ORDER BY lower(em)) FROM all_msc_emails WHERE em <> ''
),
    updated_at = now()
WHERE id = '3560721a-3432-4413-ac35-114db9c5d386';

UPDATE public.recurring_quotations
SET customer_id = '3560721a-3432-4413-ac35-114db9c5d386'
WHERE customer_id IN ('dcc98c18-c619-47b5-b9f8-e12287d6dba6','020689c4-f428-45c7-bf96-9f82ac4d5742','a82acfe3-885d-425f-bb71-a8607535214b');

DELETE FROM public.customers
WHERE id IN ('dcc98c18-c619-47b5-b9f8-e12287d6dba6','020689c4-f428-45c7-bf96-9f82ac4d5742','a82acfe3-885d-425f-bb71-a8607535214b');

-- Merge Berkshire/PTS/BTSG group into BERKSHIRE eSUPPLY NETWORK
WITH all_berk_emails AS (
  SELECT DISTINCT trim(unnest(string_to_array(c.email, ','))) AS em
  FROM public.customers c
  WHERE c.id IN ('a2e9422c-5177-4be5-817d-de4b0614a8c1','2f13b66a-93f6-43ef-9418-f513152b45c5','44a120d5-d37e-4bdf-abe1-c1fc51457392')
)
UPDATE public.customers
SET email = (
  SELECT string_agg(em, ',' ORDER BY lower(em)) FROM all_berk_emails WHERE em <> ''
),
    updated_at = now()
WHERE id = 'a2e9422c-5177-4be5-817d-de4b0614a8c1';

UPDATE public.recurring_quotations
SET customer_id = 'a2e9422c-5177-4be5-817d-de4b0614a8c1'
WHERE customer_id IN ('2f13b66a-93f6-43ef-9418-f513152b45c5','44a120d5-d37e-4bdf-abe1-c1fc51457392');

DELETE FROM public.customers
WHERE id IN ('2f13b66a-93f6-43ef-9418-f513152b45c5','44a120d5-d37e-4bdf-abe1-c1fc51457392');

COMMIT;