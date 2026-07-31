# Telegram bildirishnomalar + bot menyu

## Secrets

```bash
npx supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
npx supabase secrets set TELEGRAM_BOSS_CHAT_ID="123456789"
```

Yoki Dashboard → **Project Settings → Edge Functions → Secrets**.

Chat ID olish: `@userinfobot` yoki `@getidsbot` ga yozing.

Ixtiyoriy xavfsizlik:

```bash
npx supabase secrets set TELEGRAM_WEBHOOK_SECRET="uzun-tasodifiy-kalit"
```

## Deploy

```bash
npx supabase functions deploy send-telegram-notification --no-verify-jwt
npx supabase functions deploy telegram-bot --no-verify-jwt
```

## Bot menyu (Balans / Monitoring / Rasxot)

Boss chatida pastda tugmalar:

| Tugma | Natija |
|-------|--------|
| 💰 Balans | `SUM(payments) − SUM(expenses)` — aktiv kassa (hamma vaqt) |
| 📊 Monitoring | Sana tanlash → to‘lovlar + rasxotlar |
| 📤 Rasxot | Sana tanlash → faqat rasxotlar |

Sana tanlash (Monitoring va Rasxot):

| Tanlov | Davr |
|--------|------|
| 📅 Bugun | Bugungi kun (Tashkent) |
| 🗓 7 kun | Oxirgi 7 kun |
| ✏️ Sana tanlash | `31.07.2026` yoki `01.07.2026-31.07.2026` |

Buyruqlar: `/start`, `/balans`, `/monitoring`, `/rasxot`

Faqat `TELEGRAM_BOSS_CHAT_ID` dagi chat javob oladi.

### Webhookni bir marta ulash

Deploydan keyin **qayta** chaqiring — `callback_query` (sana tugmalari) uchun kerak.

`CRON_SECRET` o‘rnatilgan bo‘lsa:

```bash
curl "https://XXXX.supabase.co/functions/v1/telegram-bot?setup=1" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Yoki Bot API:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://XXXX.supabase.co/functions/v1/telegram-bot" \
  -d 'allowed_updates=["message","callback_query"]'
```

Keyin botga `/start` yuboring — tugmalar chiqadi.

## Avtomatik bildirishnomalar

| Type | Qayerdan |
|------|----------|
| `payment` | Payments.jsx |
| `new_student` | Students.jsx |
| `expense` | Expenses.jsx |

Telegram ishlamasa ham CRM saqlash davom etadi (fire-and-forget).

## Avtomatik hisobotlar

Haftalik / oylik hisobotlar: [`CRON_REPORTS.md`](./CRON_REPORTS.md)
