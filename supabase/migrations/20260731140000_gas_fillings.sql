-- Gaz quyish (mashina uchun alohida rasxot bo'limi)

CREATE TABLE IF NOT EXISTS public.gas_fillings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL,
  volume_m3 numeric NOT NULL CHECK (volume_m3 > 0),
  price_per_m3 numeric NOT NULL CHECK (price_per_m3 > 0),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  filled_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gas_fillings_filled_at_idx ON public.gas_fillings (filled_at DESC);
CREATE INDEX IF NOT EXISTS gas_fillings_plate_idx ON public.gas_fillings (plate_number);

ALTER TABLE public.gas_fillings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gas_fillings_select ON public.gas_fillings;
CREATE POLICY gas_fillings_select ON public.gas_fillings
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier', 'viewer'));

DROP POLICY IF EXISTS gas_fillings_insert ON public.gas_fillings;
CREATE POLICY gas_fillings_insert ON public.gas_fillings
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_fillings_update ON public.gas_fillings;
CREATE POLICY gas_fillings_update ON public.gas_fillings
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'))
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_fillings_delete ON public.gas_fillings;
CREATE POLICY gas_fillings_delete ON public.gas_fillings
  FOR DELETE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

GRANT SELECT ON public.gas_fillings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gas_fillings TO authenticated;
