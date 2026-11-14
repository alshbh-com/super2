GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_office_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, kind, related_id)
  SELECT p.id,
         'تحديث حالة أوردر',
         'تم تحديث حالة الأوردر ' || COALESCE(NEW.barcode, NEW.tracking_id, '') ||
         CASE WHEN s.name IS NOT NULL THEN ' إلى ' || s.name ELSE '' END,
         'order_status',
         NEW.id
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'office'
  WHERE p.office_id = NEW.office_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_office_order_status_change_trigger ON public.orders;
CREATE TRIGGER notify_office_order_status_change_trigger
AFTER UPDATE OF status_id ON public.orders
FOR EACH ROW
WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
EXECUTE FUNCTION public.notify_office_order_status_change();

CREATE OR REPLACE FUNCTION public.notify_office_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold integer := 5;
BEGIN
  IF NEW.office_id IS NULL OR NEW.quantity IS NOT DISTINCT FROM OLD.quantity THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(value, '')::integer, 5)
    INTO threshold
    FROM public.app_settings
   WHERE key = 'low_stock_threshold';
  threshold := COALESCE(threshold, 5);

  IF NEW.quantity <= threshold AND OLD.quantity > threshold THEN
    INSERT INTO public.notifications (user_id, title, body, kind, related_id)
    SELECT p.id,
           'تنبيه انخفاض المخزون',
           'الكمية المتاحة من ' || NEW.name || ' أصبحت ' || NEW.quantity || ' قطعة',
           'low_stock',
           NEW.id
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'office'
    WHERE p.office_id = NEW.office_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_office_low_stock_trigger ON public.products;
CREATE TRIGGER notify_office_low_stock_trigger
AFTER UPDATE OF quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_office_low_stock();