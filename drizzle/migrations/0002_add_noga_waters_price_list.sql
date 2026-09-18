ALTER TABLE public.catalog_prices ADD COLUMN IF NOT EXISTS noga_waters numeric;

ALTER TABLE public.customer_accounts DROP CONSTRAINT IF EXISTS customer_accounts_price_list_check;
ALTER TABLE public.customer_accounts ADD CONSTRAINT customer_accounts_price_list_check
  CHECK (price_list IS NULL OR price_list IN ('EURO','DOLLAR','SHEKEL','NOGA_BV_EURO','CHINA_DOLLAR','WAYDART_DOLLAR','NOGA_WATERS') OR price_list LIKE 'custom:%');

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_price_list_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_price_list_check
  CHECK (price_list IS NULL OR price_list IN ('EURO','DOLLAR','SHEKEL','NOGA_BV_EURO','CHINA_DOLLAR','WAYDART_DOLLAR','NOGA_WATERS') OR price_list LIKE 'custom:%');