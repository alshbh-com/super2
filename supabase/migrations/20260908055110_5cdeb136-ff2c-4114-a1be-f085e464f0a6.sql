ALTER TABLE public.office_daily_expenses
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'daily';

ALTER TABLE public.office_daily_expenses
  ALTER COLUMN office_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_office_daily_expenses_type
  ON public.office_daily_expenses (expense_type, expense_date);