INSERT INTO public.order_statuses (name, color, sort_order)
SELECT v.name, v.color, v.sort_order FROM (VALUES
  ('مؤجل لخط سير المندوب', '#0ea5e9', 11),
  ('مؤجل من العميل', '#6366f1', 12),
  ('رفض دفع شحن', '#b91c1c', 13)
) AS v(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.order_statuses s WHERE s.name = v.name);