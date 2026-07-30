# Telegram bildirishnomalar

Boshliqqa bir tomonlama `sendMessage` — webhook/server kerak emas.

## Secrets

```bash
npx supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
npx supabase secrets set TELEGRAM_BOSS_CHAT_ID="123456789"
```

Yoki Dashboard → **Project Settings → Edge Functions → Secrets**.

Chat ID olish: `@userinfobot` yoki `@getidsbot` ga yozing.

## Deploy

```bash
npx supabase functions deploy send-telegram-notification
```

## Qachon yuboriladi

| Type | Qayerdan |
|------|----------|
| `payment` | Payments.jsx |
| `new_student` | Students.jsx |
| `expense` | Expenses.jsx |

Telegram ishlamasa ham CRM saqlash davom etadi (fire-and-forget).

## Avtomatik hisobotlar

Haftalik / oylik hisobotlar: [`CRON_REPORTS.md`](./CRON_REPORTS.md)
