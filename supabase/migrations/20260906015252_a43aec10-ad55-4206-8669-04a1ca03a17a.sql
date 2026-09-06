ALTER TABLE public.products ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_office_id_idx ON public.products(office_id);