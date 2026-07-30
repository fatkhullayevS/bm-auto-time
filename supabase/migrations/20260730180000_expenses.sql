-- Rasxotlar (expenses) jadvallari

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_created_at_idx ON public.expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_category_id_idx ON public.expenses (category_id);
CREATE INDEX IF NOT EXISTS expenses_created_by_idx ON public.expenses (created_by);

-- Helper: joriy foydalanuvchi roli
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- expense_categories: o'qish — boss, kassir, viewer
DROP POLICY IF EXISTS expense_categories_select ON public.expense_categories;
CREATE POLICY expense_categories_select ON public.expense_categories
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier', 'viewer'));

-- expense_categories: yozish — faqat boss, kassir
DROP POLICY IF EXISTS expense_categories_insert ON public.expense_categories;
CREATE POLICY expense_categories_insert ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS expense_categories_update ON public.expense_categories;
CREATE POLICY expense_categories_update ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'))
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS expense_categories_delete ON public.expense_categories;
CREATE POLICY expense_categories_delete ON public.expense_categories
  FOR DELETE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

-- expenses: o'qish — boss, kassir, viewer
DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier', 'viewer'));

-- expenses: yozish — faqat boss, kassir
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'))
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

-- Boshlang'ich kategoriyalar
INSERT INTO public.expense_categories (name) VALUES
  ('Ofis harajatlari'),
  ('Ovqatlanish'),
  ('Boshliqqa pul berish'),
  ('Kommunal'),
  ('Transport')
ON CONFLICT (name) DO NOTHING;

GRANT SELECT ON public.expense_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT SELECT ON public.expenses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
