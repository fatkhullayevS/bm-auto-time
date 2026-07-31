-- Gaz uchun umumiy byudjet (ajratma). Quyishlar shu byudjetdan ayiriladi.
-- Kassa balansi: faqat ajratmalar hisobga olinadi (quyishlar ikki marta ayirilmasin).

CREATE TABLE IF NOT EXISTS public.gas_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0),
  notes text,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gas_allocations_allocated_at_idx
  ON public.gas_allocations (allocated_at DESC);

ALTER TABLE public.gas_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gas_allocations_select ON public.gas_allocations;
CREATE POLICY gas_allocations_select ON public.gas_allocations
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier', 'viewer'));

DROP POLICY IF EXISTS gas_allocations_insert ON public.gas_allocations;
CREATE POLICY gas_allocations_insert ON public.gas_allocations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_allocations_update ON public.gas_allocations;
CREATE POLICY gas_allocations_update ON public.gas_allocations
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'))
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_allocations_delete ON public.gas_allocations;
CREATE POLICY gas_allocations_delete ON public.gas_allocations
  FOR DELETE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

GRANT SELECT ON public.gas_allocations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gas_allocations TO authenticated;
