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

type TgSendOpts = {
  chatId?: string | number
  replyMarkup?: Record<string, unknown>
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan')
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const tgJson = await tgRes.json().catch(() => ({}))
  if (!tgRes.ok || !tgJson.ok) {
    console.error(`Telegram API ${method} xato:`, tgJson)
    throw new Error(tgJson?.description || `Telegram ${method} xato`)
  }
  return tgJson
}

export async function sendTelegramMessage(text: string, opts: TgSendOpts = {}) {
  const defaultChat = Deno.env.get('TELEGRAM_BOSS_CHAT_ID')
  const chatId = opts.chatId ?? defaultChat
  if (!chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN yoki TELEGRAM_BOSS_CHAT_ID sozlanmagan')
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  if (opts.replyMarkup) body.reply_markup = opts.replyMarkup
  return telegramApi('sendMessage', body)
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
  if (text) body.text = text
  try {
    await telegramApi('answerCallbackQuery', body)
  } catch (e) {
    console.error('answerCallbackQuery:', e)
  }
}

/** Boss paneli: Balans + Monitoring + Rasxot */
export function bossMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '💰 Balans' }, { text: '📊 Monitoring' }],
      [{ text: '📤 Rasxot' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  }
}

/** Sana tanlash: Bugun / 7 kun / maxsus sana */
export function periodChoiceKeyboard(prefix: 'exp' | 'mon') {
  return {
    inline_keyboard: [
      [
        { text: '📅 Bugun', callback_data: `${prefix}:today` },
        { text: '🗓 7 kun', callback_data: `${prefix}:7d` },
      ],
      [{ text: '✏️ Sana tanlash', callback_data: `${prefix}:custom` }],
    ],
  }
}

export type DateRange = { start: Date; end: Date; label: string }

/** Bugungi kun (Asia/Tashkent) chegaralari */
export function todayTashkentRange(): DateRange {
  const { year, month, day } = tashkentParts()
  const { start, end } = tashkentDayBounds(year, month, day)
  return {
    start,
    end,
    label: formatTashkentDate(year, month, day),
  }
}

/** Oxirgi N kun: bugun va undan oldingi (N-1) kun (Tashkent) */
export function lastNDaysTashkentRange(n: number): DateRange {
  const { year, month, day } = tashkentParts()
  const startDt = new Date(Date.UTC(year, month - 1, day - (n - 1)))
  const sy = startDt.getUTCFullYear()
  const sm = startDt.getUTCMonth() + 1
  const sd = startDt.getUTCDate()
  const { start } = tashkentDayBounds(sy, sm, sd)
  const { end } = tashkentDayBounds(year, month, day)
  return {
    start,
    end,
    label: n === 1
      ? formatTashkentDate(year, month, day)
      : `${formatTashkentDate(sy, sm, sd)} — ${formatTashkentDate(year, month, day)}`,
  }
}

/** Bitta kun yoki oraliq (Tashkent) */
export function rangeFromYmd(
  y1: number, m1: number, d1: number,
  y2?: number, m2?: number, d2?: number,
): DateRange | null {
  if (!isValidYmd(y1, m1, d1)) return null
  if (y2 != null && m2 != null && d2 != null && !isValidYmd(y2, m2, d2)) return null

  let a = { year: y1, month: m1, day: d1 }
  let b = y2 != null && m2 != null && d2 != null
    ? { year: y2, month: m2, day: d2 }
    : a

  const aMs = Date.UTC(a.year, a.month - 1, a.day)
  const bMs = Date.UTC(b.year, b.month - 1, b.day)
  if (aMs > bMs) {
    const tmp = a
    a = b
    b = tmp
  }

  const { start } = tashkentDayBounds(a.year, a.month, a.day)
  const { end } = tashkentDayBounds(b.year, b.month, b.day)
  const same = a.year === b.year && a.month === b.month && a.day === b.day
  return {
    start,
    end,
    label: same
      ? formatTashkentDate(a.year, a.month, a.day)
      : `${formatTashkentDate(a.year, a.month, a.day)} — ${formatTashkentDate(b.year, b.month, b.day)}`,
  }
}

function isValidYmd(y: number, m: number, d: number) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

/** "31.07.2026" yoki "01.07.2026-31.07.2026" */
export function parseDateRangeText(text: string): DateRange | null {
  const t = text.trim().replace(/\s+/g, '')
  const m = t.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[-–—](\d{1,2})\.(\d{1,2})\.(\d{4}))?$/,
  )
  if (!m) return null
  const d1 = Number(m[1]), mo1 = Number(m[2]), y1 = Number(m[3])
  if (m[4]) {
    return rangeFromYmd(y1, mo1, d1, Number(m[6]), Number(m[5]), Number(m[4]))
  }
  return rangeFromYmd(y1, mo1, d1)
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
