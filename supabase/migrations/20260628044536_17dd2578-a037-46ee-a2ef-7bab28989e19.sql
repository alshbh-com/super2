
ALTER TABLE public.delivery_prices ADD COLUMN IF NOT EXISTS return_compensation NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_prices ALTER COLUMN office_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_prices_office_gov_uniq
  ON public.delivery_prices (COALESCE(office_id::text, 'GLOBAL'), governorate);
