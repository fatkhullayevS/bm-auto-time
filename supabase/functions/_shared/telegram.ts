export function escapeHtml(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function fmtMoney(n: unknown) {
  if (n === null || n === undefined || n === '') return '0'
  if (typeof n === 'string') {
    const digits = n.replace(/[^\d.-]/g, '')
    return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(digits) || 0))
  }
  return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0))
}

export function nowTashkent() {
  return new Date().toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

/** Asia/Tashkent bo'yicha YYYY-MM-DD HH:mm:ss qismlari */
export function tashkentParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Tashkent kalendar sanasini UTC Instant sifatida (kun boshi / oxiri) */
export function tashkentDayBounds(year: number, month: number, day: number) {
  // Tashkent = UTC+5 (DST yo'q)
  const start = new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999)) // 23:59:59 Tashkent
  return { start, end }
}

export function formatTashkentDate(year: number, month: number, day: number) {
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return `${dd}.${mm}.${year}`
}

export function uzMonthName(month1to12: number) {
  return UZ_MONTHS[month1to12 - 1] || String(month1to12)
}

/** O'tgan to'liq oy (Tashkent) */
export function previousMonthRange() {
  const { year, month } = tashkentParts()
  let py = year
  let pm = month - 1
  if (pm < 1) {
    pm = 12
    py -= 1
  }
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate() // oy oxiri
  const { start } = tashkentDayBounds(py, pm, 1)
  const { end } = tashkentDayBounds(py, pm, lastDay)
  return {
    start,
    end,
    label: `${uzMonthName(pm)} ${py}`,
  }
}

/** O'tgan hafta: Dushanba 00:00 — Yakshanba 23:59 (Tashkent) */
export function previousWeekRange() {
  const { year, month, day } = tashkentParts()
  // Kalendar sanasi uchun hafta kuni (0=Yakshanba ... 6=Shanba)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const daysSinceMonday = (dow + 6) % 7 // Dushanba=0 ... Yakshanba=6

  const shift = (y: number, m: number, d: number, delta: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d + delta))
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() }
  }

  const monday = shift(year, month, day, -(daysSinceMonday + 7))
  const sunday = shift(year, month, day, -(daysSinceMonday + 1))

  const { start } = tashkentDayBounds(monday.year, monday.month, monday.day)
  const { end } = tashkentDayBounds(sunday.year, sunday.month, sunday.day)

  return {
    start,
    end,
    label: `${formatTashkentDate(monday.year, monday.month, monday.day)} — ${formatTashkentDate(sunday.year, sunday.month, sunday.day)}`,
  }
}

export async function sendTelegramMessage(text: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_BOSS_CHAT_ID')
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN yoki TELEGRAM_BOSS_CHAT_ID sozlanmagan')
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
  const tgJson = await tgRes.json().catch(() => ({}))
  if (!tgRes.ok || !tgJson.ok) {
    console.error('Telegram API xato:', tgJson)
    throw new Error(tgJson?.description || 'Telegram yuborilmadi')
  }
  return tgJson
}

/** Cron so'rovini tekshirish: x-cron-secret yoki Authorization Bearer */
export function assertCronAuth(req: Request) {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret) {
    console.warn('CRON_SECRET sozlanmagan — so\'rov ochiq')
    return true
  }
  const headerSecret = req.headers.get('x-cron-secret')
  const auth = req.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (headerSecret === secret || bearer === secret) return true
  return false
}
