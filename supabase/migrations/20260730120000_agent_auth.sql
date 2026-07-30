-- Agent custom auth columns (Supabase Auth'dan alohida)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS login text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Unique login (faqat to'ldirilgan login'lar uchun)
CREATE UNIQUE INDEX IF NOT EXISTS agents_login_unique
  ON agents (login)
  WHERE login IS NOT NULL AND login <> '';

COMMENT ON COLUMN agents.login IS 'Masul login (custom auth, auth.users emas)';
COMMENT ON COLUMN agents.password_hash IS 'bcrypt hash — hech qachon plain text saqlanmasin';
COMMENT ON COLUMN agents.is_active IS 'false bo''lsa login bloklanadi';

-- Client (anon/authenticated) password_hash ustunini o'qiy olmasin
-- Edge Function service_role orqali o'qiydi
REVOKE SELECT (password_hash) ON public.agents FROM anon, authenticated;
