# Ma'sul (Agent) Auth — deploy qo'llanma

## 1. Migration (SQL)

Supabase Dashboard → **SQL Editor** → quyidagi faylni ishga tushiring:

`supabase/migrations/20260730120000_agent_auth.sql`

Yoki CLI:

```bash
npx supabase db push
# yoki
npx supabase link --project-ref ygqffofmaapjdziqwkzj
npx supabase db push
```

## 2. Edge Function secret

Dashboard → **Project Settings → Edge Functions → Secrets** (yoki CLI):

```bash
npx supabase secrets set AGENT_JWT_SECRET="uzun-tasodifiy-maxfiy-kalit-kamida-32-belgi"
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` avtomatik mavjud.

## 3. Functionlarni deploy

```bash
npx supabase functions deploy agent-login
npx supabase functions deploy agent-set-password
npx supabase functions deploy agent-get-students
npx supabase functions deploy agent-add-payment
```

Yoki birgalikda:

```bash
npx supabase functions deploy
```

## 4. Tekshirish

1. Boss/kassir sifatida kiring → Ma'sullar → yangi ma'sul + login/parol
2. Chiqing → Login → **Ma'sul** tab → shu login/parol
3. Faqat o'quvchilarim + to'lov ko'rinishi kerak

## Functionlar

| Function | Kim chaqiradi | Vazifa |
|----------|---------------|--------|
| `agent-login` | Public (anon) | Login/parol → JWT |
| `agent-set-password` | boss/kassir Auth | bcrypt hash yozish |
| `agent-get-students` | Agent JWT | Faqat o'z o'quvchilari |
| `agent-add-payment` | Agent JWT | Faqat o'z o'quvchisiga to'lov |
