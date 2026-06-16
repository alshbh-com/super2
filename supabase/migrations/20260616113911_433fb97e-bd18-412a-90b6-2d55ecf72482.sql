-- Add branch role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch';

-- Add return shipping compensation to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS return_shipping_compensation NUMERIC NOT NULL DEFAULT 0;

-- Add branch_id (optional) to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON public.orders(branch_id);