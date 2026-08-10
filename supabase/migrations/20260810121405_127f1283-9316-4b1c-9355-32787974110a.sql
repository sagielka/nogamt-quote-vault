CREATE TABLE public.catalog_prices (
  sku text PRIMARY KEY,
  description text,
  euro numeric,
  dollar numeric,
  shekel numeric,
  noga_bv_euro numeric,
  china_dollar numeric,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_prices TO authenticated;
GRANT ALL ON public.catalog_prices TO service_role;
ALTER TABLE public.catalog_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view catalog prices"
  ON public.catalog_prices FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_catalog_prices_updated_at
BEFORE UPDATE ON public.catalog_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.catalog_sync_state (
  id text PRIMARY KEY DEFAULT 'default',
  drive_file_id text,
  drive_file_name text,
  drive_modified_time timestamptz,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  items_added integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_sync_state TO authenticated;
GRANT ALL ON public.catalog_sync_state TO service_role;
ALTER TABLE public.catalog_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view sync state"
  ON public.catalog_sync_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update sync state"
  ON public.catalog_sync_state FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert sync state"
  ON public.catalog_sync_state FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_catalog_sync_state_updated_at
BEFORE UPDATE ON public.catalog_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.catalog_sync_state (id, drive_file_id, drive_file_name)
VALUES ('default', '1izOLq52viwyfqEsj6i2Q97z-u22ZzKuL', 'NOGA MT 2026-04 MASTER PRICE LIST.xlsx');