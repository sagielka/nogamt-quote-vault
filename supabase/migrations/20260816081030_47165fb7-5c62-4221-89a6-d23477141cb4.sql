UPDATE public.customers
SET email = (
  SELECT string_agg(DISTINCT lower(trim(unnest)), ',' ORDER BY lower(trim(unnest)))
  FROM unnest(string_to_array(email, ','))
  WHERE trim(unnest) <> ''
),
updated_at = now()
WHERE id IN ('3560721a-3432-4413-ac35-114db9c5d386', 'a2e9422c-5177-4be5-817d-de4b0614a8c1');