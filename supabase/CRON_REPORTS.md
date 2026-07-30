# Telegram hisobotlar (haftalik / oylik)

Avtomatik moliyaviy hisobot boshliq Telegramiga.

## Secrets

```bash
npx supabase secrets set TELEGRAM_BOT_TOKEN="..."
npx supabase secrets set TELEGRAM_BOSS_CHAT_ID="..."
npx supabase secrets set CRON_SECRET="uzun-tasodifiy-kalit"
```

`CRON_SECRET` — faqat cron-job.org so‘rovlari uchun. Header: `x-cron-secret`.

## Deploy

```bash
npx supabase functions deploy weekly-report
npx supabase functions deploy monthly-report
```

## cron-job.org sozlash

Project ref: `.env` dagi URL dan (`https://XXXX.supabase.co` → `XXXX`).

### 1) Haftalik — har Dushanba 09:00 (Asia/Tashkent)

- URL: `https://XXXX.supabase.co/functions/v1/weekly-report`
- Method: `POST` (yoki GET)
- Schedule: Every Monday at 09:00, timezone **Asia/Tashkent**
- Headers:
  - `x-cron-secret: <CRON_SECRET>`
  - `apikey: <SUPABASE_ANON_KEY>` (ixtiyoriy, ba’zi gatewaylar uchun)

### 2) Oylik — har oyning 1-sanasi 09:00 (Asia/Tashkent)

- URL: `https://XXXX.supabase.co/functions/v1/monthly-report`
- Method: `POST`
- Schedule: On the 1st of every month at 09:00, timezone **Asia/Tashkent**
- Headers: xuddi yuqoridagidek `x-cron-secret`

## Davrlar

| Function | Davr |
|----------|------|
| `weekly-report` | O‘tgan hafta (Dushanba–Yakshanba) |
| `monthly-report` | O‘tgan to‘liq oy |

Balans doim **butun tarix**: `SUM(payments) − SUM(expenses)`.

## Qo‘lda sinash

```bash
curl -X POST "https://XXXX.supabase.co/functions/v1/weekly-report" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
