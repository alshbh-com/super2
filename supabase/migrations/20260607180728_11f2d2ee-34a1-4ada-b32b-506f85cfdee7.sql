ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_return_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_return_received_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_orders_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL THEN
    NEW.last_modified_by := uid;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF NEW.is_closed = true AND (OLD.is_closed IS DISTINCT FROM true) THEN
      NEW.closed_by := COALESCE(uid, NEW.closed_by);
      IF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
    END IF;
    IF NEW.is_closed = false AND OLD.is_closed = true THEN
      NEW.closed_by := NULL;
      NEW.closed_at := NULL;
    END IF;

    IF NEW.is_courier_closed = true AND (OLD.is_courier_closed IS DISTINCT FROM true) THEN
      NEW.courier_closed_by := COALESCE(uid, NEW.courier_closed_by);
    END IF;
    IF NEW.is_courier_closed = false AND OLD.is_courier_closed = true THEN
      NEW.courier_closed_by := NULL;
    END IF;

    IF NEW.returned_to_sender = true AND (OLD.returned_to_sender IS DISTINCT FROM true) THEN
      NEW.returned_to_sender_at := now();
      NEW.returned_to_sender_by := COALESCE(uid, NEW.returned_to_sender_by);
    END IF;
    IF NEW.returned_to_sender = false AND OLD.returned_to_sender = true THEN
      NEW.returned_to_sender_at := NULL;
      NEW.returned_to_sender_by := NULL;
    END IF;

    IF NEW.courier_collected_at IS NOT NULL AND OLD.courier_collected_at IS NULL THEN
      NEW.collected_at := COALESCE(NEW.collected_at, NEW.courier_collected_at::date);
    END IF;
    IF NEW.courier_return_received_at IS NOT NULL AND OLD.courier_return_received_at IS NULL THEN
      NEW.return_received_at := COALESCE(NEW.return_received_at, NEW.courier_return_received_at::date);
    END IF;
    IF NEW.sender_collected_at IS NOT NULL AND OLD.sender_collected_at IS NULL THEN
      NEW.collected_at := COALESCE(NEW.collected_at, NEW.sender_collected_at::date);
    END IF;
    IF NEW.sender_return_received_at IS NOT NULL AND OLD.sender_return_received_at IS NULL THEN
      NEW.return_received_at := COALESCE(NEW.return_received_at, NEW.sender_return_received_at::date);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;