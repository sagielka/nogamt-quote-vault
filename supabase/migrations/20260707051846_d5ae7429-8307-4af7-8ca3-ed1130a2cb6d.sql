DO $$
DECLARE
  r RECORD;
  new_items JSONB;
  it JSONB;
  changed BOOLEAN;
  desc_u TEXT;
  sku_u TEXT;
  cur TEXT;
  parts TEXT[];
  grp TEXT;
  usd NUMERIC;
  cost NUMERIC;
  cur_cost NUMERIC;
  rate NUMERIC;
  tbl TEXT;
  group_costs_usd JSONB := '{"B":37.597,"C":37.5803,"D":47.8303,"E":52.7788,"F":55.3288,"G":57.6788}'::jsonb;
  rates JSONB := '{"USD":1,"EUR":0.92,"GBP":0.79,"ILS":3.6,"JPY":150,"CNY":7.2}'::jsonb;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['quotations','archived_quotations'] LOOP
    FOR r IN EXECUTE format('SELECT id, items, currency FROM public.%I', tbl) LOOP
      new_items := '[]'::jsonb;
      changed := false;
      cur := COALESCE(r.currency, 'USD');
      rate := COALESCE((rates->>cur)::numeric, 1);
      FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(r.items, '[]'::jsonb)) LOOP
        cur_cost := NULLIF(it->>'costPrice','')::numeric;
        IF cur_cost IS NOT NULL AND cur_cost > 0 THEN
          new_items := new_items || it;
          CONTINUE;
        END IF;
        sku_u := UPPER(COALESCE(it->>'sku',''));
        desc_u := UPPER(COALESCE(it->>'description',''));
        IF sku_u LIKE 'US%' OR desc_u LIKE 'US-%' OR desc_u LIKE 'US %' THEN
          grp := NULL;
          parts := string_to_array(desc_u,'-');
          IF array_length(parts,1) >= 4 AND length(parts[4]) = 1 AND parts[4] IN ('B','C','D','E','F','G') THEN
            grp := parts[4];
          ELSE
            FOREACH grp IN ARRAY ARRAY['B','C','D','E','F','G'] LOOP
              IF position('-'||grp||'-' in desc_u) > 0 THEN EXIT; END IF;
              grp := NULL;
            END LOOP;
          END IF;
          IF grp IS NOT NULL THEN
            usd := (group_costs_usd->>grp)::numeric;
            IF usd IS NOT NULL AND usd > 0 THEN
              cost := round(usd * rate * 100) / 100.0;
              it := jsonb_set(it, '{costPrice}', to_jsonb(cost));
              changed := true;
            END IF;
          END IF;
        END IF;
        new_items := new_items || it;
      END LOOP;
      IF changed THEN
        EXECUTE format('UPDATE public.%I SET items = $1 WHERE id = $2', tbl) USING new_items, r.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;