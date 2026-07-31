-- Gaz: mashina raqamlari (alohida ro'yxat)

CREATE TABLE IF NOT EXISTS public.gas_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gas_vehicles_plate_unique UNIQUE (plate_number)
);

CREATE INDEX IF NOT EXISTS gas_vehicles_plate_idx ON public.gas_vehicles (plate_number);

ALTER TABLE public.gas_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gas_vehicles_select ON public.gas_vehicles;
CREATE POLICY gas_vehicles_select ON public.gas_vehicles
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier', 'viewer'));

DROP POLICY IF EXISTS gas_vehicles_insert ON public.gas_vehicles;
CREATE POLICY gas_vehicles_insert ON public.gas_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_vehicles_update ON public.gas_vehicles;
CREATE POLICY gas_vehicles_update ON public.gas_vehicles
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'))
  WITH CHECK (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

DROP POLICY IF EXISTS gas_vehicles_delete ON public.gas_vehicles;
CREATE POLICY gas_vehicles_delete ON public.gas_vehicles
  FOR DELETE TO authenticated
  USING (public.current_profile_role() IN ('boss', 'kassir', 'cashier'));

GRANT SELECT ON public.gas_vehicles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gas_vehicles TO authenticated;
