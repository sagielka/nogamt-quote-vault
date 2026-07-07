
-- Backfill costPrice on quotations.items and archived_quotations.items for US-... SKUs
-- Cost is derived from the GROUP letter (B-G) found in the description, converted to the row's currency.

DO $$
DECLARE
  group_costs_usd jsonb := jsonb_build_object(
    'B', 37.597,
    'C', 37.5803,
    'D', 47.8303,
    'E', 52.7788,
    'F', 55.3288,
    'G', 57.6788
  );
  rates jsonb := jsonb_build_object(
    'USD', 1, 'EUR', 0.92, 'GBP', 0.79, 'ILS', 3.6, 'JPY', 150, 'CNY', 7.2
  );
  r record;
  new_items jsonb;
  it jsonb;
  sku text;
  descr text;
  cur_cost numeric;
  letter text;
  parts text[];
  usd numeric;
  rate numeric;
  cost_val numeric;
  changed boolean;
BEGIN
  FOR r IN
    SELECT id, items, currency, 'quotations'::text AS tbl FROM public.quotations WHERE jsonb_typeof(items) = 'array'
    UNION ALL
    SELECT id, items, currency, 'archived_quotations'::text AS tbl FROM public.archived_quotations WHERE jsonb_typeof(items) = 'array'
  LOOP
    new_items := '[]'::jsonb;
    changed := false;
    rate := COALESCE((rates ->> COALESCE(r.currency,'USD'))::numeric, 1);

    FOR it IN SELECT * FROM jsonb_array_elements(r.items)
    LOOP
      sku := upper(trim(COALESCE(it->>'sku','')));
      descr := upper(COALESCE(it->>'description',''));
      cur_cost := COALESCE(NULLIF(it->>'costPrice','')::numeric, 0);
      letter := NULL;

      IF cur_cost <= 0 AND sku LIKE 'US%' THEN
        parts := string_to_array(descr, '-');
        IF array_length(parts,1) >= 4 AND length(parts[4]) = 1 AND parts[4] IN ('B','C','D','E','F','G') THEN
          letter := parts[4];
        ELSE
          FOR letter IN SELECT l FROM unnest(ARRAY['B','C','D','E','F','G']) l LOOP
            IF descr LIKE '%-' || letter || '-%' THEN EXIT; END IF;
            letter := NULL;
          END LOOP;
        END IF;

        IF letter IS NOT NULL THEN
          usd := (group_costs_usd ->> letter)::numeric;
          cost_val := round(usd * rate * 100) / 100;
          it := jsonb_set(it, '{costPrice}', to_jsonb(cost_val), true);
          changed := true;
        END IF;
      END IF;

      new_items := new_items || it;
    END LOOP;

    IF changed THEN
      IF r.tbl = 'quotations' THEN
        UPDATE public.quotations SET items = new_items WHERE id = r.id;
      ELSE
        UPDATE public.archived_quotations SET items = new_items WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;
