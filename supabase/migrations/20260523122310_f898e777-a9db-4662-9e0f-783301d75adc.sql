
-- =========================================================
-- Super shipping services — Full schema
-- =========================================================

-- ===== ENUMS =====
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner','admin','courier','office','accountant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Utility: updated_at trigger =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  phone text,
  login_code text,
  employee_code text,
  address text,
  coverage_areas text,
  notes text,
  salary numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  rejection_commission numeric DEFAULT 0,
  office_id uuid,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_user_id AND role IN ('owner','admin'));
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- Profiles policies (depend on has_role)
CREATE POLICY "authenticated read profiles" ON public.profiles FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR public.is_admin_or_owner(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE
  TO authenticated USING (public.is_admin_or_owner(auth.uid()));

-- ===== USER PERMISSIONS =====
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, section)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own perms" ON public.user_permissions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "admins manage perms" ON public.user_permissions FOR ALL
  TO authenticated USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ===== OFFICES =====
CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text,
  owner_name text,
  owner_phone text,
  address text,
  notes text,
  office_commission numeric DEFAULT 0,
  can_add_orders boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_offices_upd BEFORE UPDATE ON public.offices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all offices" ON public.offices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== COMPANIES =====
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_upd BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  payment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all company_payments" ON public.company_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== PRODUCTS =====
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_upd BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== DELIVERY PRICES =====
CREATE TABLE public.delivery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  governorate text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  pickup_price numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all delivery_prices" ON public.delivery_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== ORDER STATUSES =====
CREATE TABLE public.order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all statuses" ON public.order_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed standard statuses
INSERT INTO public.order_statuses (name, color, sort_order) VALUES
  ('جديد', '#3b82f6', 1),
  ('قيد التوصيل', '#f59e0b', 2),
  ('تم التسليم', '#10b981', 3),
  ('تسليم جزئي', '#84cc16', 4),
  ('مؤجل', '#a78bfa', 5),
  ('رفض ودفع شحن', '#ef4444', 6),
  ('استلم ودفع نص الشحن', '#f97316', 7),
  ('مرتجع', '#6b7280', 8),
  ('ملغي', '#374151', 9)
ON CONFLICT (name) DO NOTHING;

-- ===== ORDERS =====
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE,
  tracking_id text,
  customer_name text,
  customer_phone text,
  customer_code text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  quantity integer DEFAULT 1,
  price numeric DEFAULT 0,
  delivery_price numeric DEFAULT 0,
  shipping_paid numeric DEFAULT 0,
  partial_amount numeric DEFAULT 0,
  color text,
  size text,
  address text,
  governorate text,
  notes text,
  priority text DEFAULT 'normal',
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  courier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status_id uuid REFERENCES public.order_statuses(id) ON DELETE SET NULL,
  is_closed boolean DEFAULT false,
  is_courier_closed boolean DEFAULT false,
  is_settled boolean DEFAULT false,
  returned_to_sender boolean DEFAULT false,
  returned_to_sender_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_courier ON public.orders(courier_id);
CREATE INDEX idx_orders_office ON public.orders(office_id);
CREATE INDEX idx_orders_status ON public.orders(status_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_upd BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Barcode sequential numeric trigger
CREATE SEQUENCE IF NOT EXISTS public.orders_barcode_seq START 100000;
CREATE OR REPLACE FUNCTION public.assign_barcode()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := nextval('public.orders_barcode_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_barcode BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_barcode();

CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all order_notes" ON public.order_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status_id uuid,
  new_status_id uuid,
  changed_by uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all status_history" ON public.order_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== DIARIES =====
CREATE TABLE public.diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  diary_date date NOT NULL DEFAULT CURRENT_DATE,
  diary_number integer,
  notes text,
  pickup_rate numeric DEFAULT 0,
  is_closed boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  lock_status_updates boolean DEFAULT false,
  prevent_new_orders boolean DEFAULT false,
  data_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_diaries_upd BEFORE UPDATE ON public.diaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all diaries" ON public.diaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.diary_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id uuid NOT NULL REFERENCES public.diaries(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status_inside_diary text,
  partial_amount numeric DEFAULT 0,
  shipping_paid numeric DEFAULT 0,
  n_column text,
  manual_return_status text,
  manual_collected numeric DEFAULT 0,
  manual_returned numeric DEFAULT 0,
  manual_notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_diary_orders_diary ON public.diary_orders(diary_id);
ALTER TABLE public.diary_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_diary_orders_upd BEFORE UPDATE ON public.diary_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all diary_orders" ON public.diary_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== COURIER =====
CREATE TABLE public.courier_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all collections" ON public.courier_collections FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.courier_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all bonuses" ON public.courier_bonuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.courier_locations (
  courier_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read locations" ON public.courier_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "courier upserts own location" ON public.courier_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = courier_id);
CREATE POLICY "courier updates own location" ON public.courier_locations FOR UPDATE TO authenticated USING (auth.uid() = courier_id) WITH CHECK (auth.uid() = courier_id);

-- ===== MESSAGES =====
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_pair ON public.messages(sender_id, receiver_id, created_at DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "users send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "users update own messages" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "users delete own messages" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ===== ACCOUNTING =====
CREATE TABLE public.advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  type text NOT NULL DEFAULT 'advance',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all advances" ON public.advances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text DEFAULT 'أخرى',
  notes text,
  expense_date date DEFAULT CURRENT_DATE,
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cash_flow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  entry_date date DEFAULT CURRENT_DATE,
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cashflow" ON public.cash_flow_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.office_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'advance',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all office_payments" ON public.office_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.office_daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  data_json jsonb,
  pickup_rate numeric DEFAULT 0,
  is_locked boolean DEFAULT false,
  is_closed boolean DEFAULT false,
  prevent_add boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_daily_closings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_odc_upd BEFORE UPDATE ON public.office_daily_closings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "auth all odc" ON public.office_daily_closings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.office_daily_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_daily_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all ode" ON public.office_daily_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== ACTIVITY LOGS =====
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_created ON public.activity_logs(created_at DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins delete logs" ON public.activity_logs FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

-- ===== APP SETTINGS =====
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SCAN SESSIONS =====
CREATE TABLE public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_count integer DEFAULT 0,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all scan_sessions" ON public.scan_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.scan_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all scan_items" ON public.scan_session_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add FK from profiles.office_id now that offices exists
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_office_fk FOREIGN KEY (office_id)
  REFERENCES public.offices(id) ON DELETE SET NULL;
