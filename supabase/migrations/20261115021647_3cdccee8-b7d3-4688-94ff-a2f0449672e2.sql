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
  LEFT JOIN public.order_statuses s ON s.id = NEW.status_id
  WHERE p.office_id = NEW.office_id;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_office_order_status_change() FROM PUBLIC, anon, authenticated;