-- Umumiy to'lov: o'quvchisiz payment + davr (dan–gacha)

ALTER TABLE public.payments
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS period_from date,
  ADD COLUMN IF NOT EXISTS period_to date;

COMMENT ON COLUMN public.payments.period_from IS 'Umumiy to''lov davri boshi (ixtiyoriy)';
COMMENT ON COLUMN public.payments.period_to IS 'Umumiy to''lov davri oxiri (ixtiyoriy)';
