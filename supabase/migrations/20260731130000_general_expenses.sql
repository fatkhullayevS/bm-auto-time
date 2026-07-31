-- Umumiy rasxot: kategoriyasiz + davr (dan–gacha)

ALTER TABLE public.expenses
  ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS period_from date,
  ADD COLUMN IF NOT EXISTS period_to date;

COMMENT ON COLUMN public.expenses.period_from IS 'Umumiy rasxot davri boshi';
COMMENT ON COLUMN public.expenses.period_to IS 'Umumiy rasxot davri oxiri';
