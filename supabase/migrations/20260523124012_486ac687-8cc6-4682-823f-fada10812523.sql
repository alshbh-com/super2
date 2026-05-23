
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS received_at date,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS customer_phone_2 text,
  ADD COLUMN IF NOT EXISTS courier_received_at date,
  ADD COLUMN IF NOT EXISTS collected_at date,
  ADD COLUMN IF NOT EXISTS return_received_at date;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipping_compensation numeric DEFAULT 0;
