import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import {
  answerCallbackQuery,
  assertCronAuth,
  bossMenuKeyboard,
  escapeHtml,
  fmtMoney,
  lastNDaysTashkentRange,
  nowTashkent,
  parseDateRangeText,
  periodChoiceKeyboard,
  sendTelegramMessage,
  todayTashkentRange,
  type DateRange,
} from '../_shared/telegram.ts'

const MAX_LINES = 25
const PENDING_TTL_MS = 10 * 60 * 1000

type PendingKind = 'expenses' | 'monitoring'
type Pending = { kind: PendingKind; ts: number }

/** Edge isolate ichida qisqa muddatli holat (bitta boss chat uchun yetarli) */
const pendingDateByChat = new Map<string, Pending>()

function normalizeCmd(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[💰📊📤📅🗓✏️]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBalance(text: string) {
  const t = normalizeCmd(text)
  return t === 'balans' || t === '/balans' || t.startsWith('/balans@')
}

function isMonitoring(text: string) {
  const t = normalizeCmd(text)
  return t === 'monitoring' || t === '/monitoring' || t.startsWith('/monitoring@')
}

function isExpenses(text: string) {
  const t = normalizeCmd(text)
  return (
    t === 'rasxot' ||
    t === 'rasxotlar' ||
    t === '/rasxot' ||
    t.startsWith('/rasxot@')
  )
}

function isStart(text: string) {
  const t = normalizeCmd(text)
  return t === '/start' || t.startsWith('/start@') || t === 'menu' || t === '/menu'
}

function setPending(chatId: string | number, kind: PendingKind) {
  pendingDateByChat.set(String(chatId), { kind, ts: Date.now() })
}

function takePending(chatId: string | number): PendingKind | null {
  const key = String(chatId)
  const p = pendingDateByChat.get(key)
  if (!p) return null
  pendingDateByChat.delete(key)
  if (Date.now() - p.ts > PENDING_TTL_MS) return null
  return p.kind
}

function clearPending(chatId: string | number) {
  pendingDateByChat.delete(String(chatId))
}

async function buildBalanceText() {
  const sb = serviceClient()
  const [{ data: pays }, { data: exps }] = await Promise.all([
    sb.from('payments').select('amount'),
    sb.from('expenses').select('amount'),
  ])
  const income = (pays || []).reduce((s, p) => s + Number(p.amount), 0)
  const expense = (exps || []).reduce((s, e) => s + Number(e.amount), 0)
  const balance = income - expense

  return [
    '💼 <b>KASSA BALANSI</b>',
    '',
    `💰 Jami to'lovlar: ${fmtMoney(income)} so'm`,
    `📤 Jami rasxotlar: ${fmtMoney(expense)} so'm`,
    '',
    `✅ <b>Aktiv balans: ${fmtMoney(balance)} so'm</b>`,
    `🕐 ${nowTashkent()}`,
  ].join('\n')
}

async function buildMonitoringText(range: DateRange) {
  const sb = serviceClient()
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const [{ data: pays }, { data: exps }] = await Promise.all([
    sb
      .from('payments')
      .select('amount, method, paid_at, period_from, period_to, students(full_name), notes')
      .gte('paid_at', startIso)
      .lte('paid_at', endIso)
      .order('paid_at', { ascending: false }),
    sb
      .from('expenses')
      .select('amount, description, created_at, period_from, period_to, expense_categories(name)')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false }),
  ])

  const payments = pays || []
  const expenses = exps || []
  const income = payments.reduce((s, p) => s + Number(p.amount), 0)
  const expenseSum = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const dayDiff = income - expenseSum

  const payLines = payments.slice(0, MAX_LINES).map((p) => {
    const name = p.students?.full_name
      ? escapeHtml(p.students.full_name)
      : (p.period_from || p.period_to
        ? `Umumiy (${escapeHtml([p.period_from, p.period_to].filter(Boolean).join(' — '))})`
        : 'Umumiy to\'lov')
    const method = escapeHtml(p.method || '—')
    return `• ${name} — ${fmtMoney(p.amount)} (${method})`
  })
  if (payments.length > MAX_LINES) {
    payLines.push(`… va yana ${payments.length - MAX_LINES} ta`)
  }

  const expLines = expenses.slice(0, MAX_LINES).map((e) => {
    const cat = e.expense_categories?.name
      ? escapeHtml(e.expense_categories.name)
      : (e.period_from || e.period_to
        ? `Umumiy (${escapeHtml([e.period_from, e.period_to].filter(Boolean).join(' — '))})`
        : 'Umumiy rasxot')
    const desc = e.description && e.expense_categories?.name
      ? ` — ${escapeHtml(e.description)}`
      : ''
    return `• ${cat}: ${fmtMoney(e.amount)}${desc}`
  })
  if (expenses.length > MAX_LINES) {
    expLines.push(`… va yana ${expenses.length - MAX_LINES} ta`)
  }

  const title = '📊 <b>MONITORING</b>'

  if (payments.length === 0 && expenses.length === 0) {
    return [
      title,
      `🗓 ${range.label}`,
      '',
      'Bu davrda to\'lov yoki rasxot yo\'q.',
      `🕐 ${nowTashkent()}`,
    ].join('\n')
  }

  return [
    title,
    `🗓 ${range.label}`,
    '',
    `💰 <b>TO'LOVLAR</b> (${payments.length} ta): ${fmtMoney(income)} so'm`,
    ...(payLines.length ? payLines : ['• Yo\'q']),
    '',
    `📤 <b>RASXOTLAR</b> (${expenses.length} ta): ${fmtMoney(expenseSum)} so'm`,
    ...(expLines.length ? expLines : ['• Yo\'q']),
    '',
    `📈 Farq: ${dayDiff >= 0 ? '+' : ''}${fmtMoney(dayDiff)} so'm`,
    `🕐 ${nowTashkent()}`,
  ].join('\n')
}

async function buildExpensesText(range: DateRange) {
  const sb = serviceClient()
  const { data: exps } = await sb
    .from('expenses')
    .select('amount, description, created_at, expense_categories(name)')
    .gte('created_at', range.start.toISOString())
    .lte('created_at', range.end.toISOString())
    .order('created_at', { ascending: false })

  const expenses = exps || []
  const expenseSum = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const expLines = expenses.slice(0, MAX_LINES).map((e) => {
    const cat = escapeHtml(e.expense_categories?.name || 'Umumiy rasxot')
    const desc = e.description ? ` — ${escapeHtml(e.description)}` : ''
    const day = new Date(e.created_at).toLocaleDateString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      day: '2-digit',
      month: '2-digit',
    })
    return `• ${day} · ${cat}: ${fmtMoney(e.amount)}${desc}`
  })
  if (expenses.length > MAX_LINES) {
    expLines.push(`… va yana ${expenses.length - MAX_LINES} ta`)
  }

  if (expenses.length === 0) {
    return [
      '📤 <b>RASXOTLAR</b>',
      `🗓 ${range.label}`,
      '',
      'Bu davrda rasxot yo\'q.',
      `🕐 ${nowTashkent()}`,
    ].join('\n')
  }

  return [
    '📤 <b>RASXOTLAR</b>',
    `🗓 ${range.label}`,
    '',
    `Jami: <b>${fmtMoney(expenseSum)} so'm</b> (${expenses.length} ta)`,
    '',
    ...expLines,
    '',
    `🕐 ${nowTashkent()}`,
  ].join('\n')
}

async function replyBoss(
  chatId: string | number,
  text: string,
  opts: { withMenu?: boolean; replyMarkup?: Record<string, unknown> } = {},
) {
  const markup = opts.replyMarkup ?? (opts.withMenu ? bossMenuKeyboard() : undefined)
  await sendTelegramMessage(text, {
    chatId,
    replyMarkup: markup,
  })
}

async function askPeriod(
  chatId: string | number,
  kind: PendingKind,
) {
  clearPending(chatId)
  const prefix = kind === 'expenses' ? 'exp' : 'mon'
  const title = kind === 'expenses' ? '📤 <b>Rasxotlar</b>' : '📊 <b>Monitoring</b>'
  await replyBoss(
    chatId,
    [
      title,
      '',
      'Davrni tanlang:',
      '• <b>Bugun</b> — bugungi kun',
      '• <b>7 kun</b> — oxirgi 7 kun',
      '• <b>Sana tanlash</b> — DD.MM.YYYY yoki oraliq',
    ].join('\n'),
    { replyMarkup: periodChoiceKeyboard(prefix) },
  )
}

async function askCustomDate(chatId: string | number, kind: PendingKind) {
  setPending(chatId, kind)
  await replyBoss(
    chatId,
    [
      '✏️ <b>Sana kiriting</b>',
      '',
      'Bitta kun: <code>31.07.2026</code>',
      'Oraliq: <code>01.07.2026-31.07.2026</code>',
    ].join('\n'),
    { withMenu: true },
  )
}

function rangeFromCallback(action: string): DateRange | null {
  if (action === 'today') return todayTashkentRange()
  if (action === '7d') return lastNDaysTashkentRange(7)
  return null
}

async function handleCallback(cq: {
  id: string
  data?: string
  from?: { id?: number }
  message?: { chat?: { id?: number } }
}) {
  const data = typeof cq.data === 'string' ? cq.data : ''
  const chatId = cq.message?.chat?.id
  if (!chatId || !data) {
    await answerCallbackQuery(cq.id)
    return jsonResponse({ ok: true, skipped: true })
  }

  const bossId = String(Deno.env.get('TELEGRAM_BOSS_CHAT_ID') || '')
  if (!bossId || String(chatId) !== bossId) {
    await answerCallbackQuery(cq.id, 'Ruxsat yo\'q')
    return jsonResponse({ ok: true, ignored: true })
  }

  const [prefix, action] = data.split(':')
  if ((prefix !== 'exp' && prefix !== 'mon') || !action) {
    await answerCallbackQuery(cq.id)
    return jsonResponse({ ok: true, skipped: true })
  }

  const kind: PendingKind = prefix === 'exp' ? 'expenses' : 'monitoring'

  if (action === 'custom') {
    await answerCallbackQuery(cq.id)
    await askCustomDate(chatId, kind)
    return jsonResponse({ ok: true, action: `${prefix}:custom` })
  }

  const range = rangeFromCallback(action)
  if (!range) {
    await answerCallbackQuery(cq.id, 'Noma\'lum tanlov')
    return jsonResponse({ ok: true, skipped: true })
  }

  await answerCallbackQuery(cq.id)
  clearPending(chatId)
  const body = kind === 'expenses'
    ? await buildExpensesText(range)
    : await buildMonitoringText(range)
  await replyBoss(chatId, body, { withMenu: true })
  return jsonResponse({ ok: true, action: `${prefix}:${action}` })
}

/** Webhookni o'rnatish: GET /telegram-bot?setup=1 + x-cron-secret */
async function setupWebhook(req: Request) {
  if (!assertCronAuth(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!token || !supabaseUrl) {
    return jsonResponse({ error: 'Secrets yetarli emas' }, 500)
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot`
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || ''

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  }
  if (secret) body.secret_token = secret

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const tgJson = await tgRes.json().catch(() => ({}))

  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Menu ochish' },
        { command: 'balans', description: 'Kassa balansi' },
        { command: 'monitoring', description: 'To\'lov va rasxotlar (sana tanlash)' },
        { command: 'rasxot', description: 'Rasxotlar (sana tanlash)' },
      ],
    }),
  }).catch(() => {})

  return jsonResponse({ ok: tgJson.ok === true, webhook: webhookUrl, telegram: tgJson })
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)

  if (req.method === 'GET' && url.searchParams.get('setup') === '1') {
    return setupWebhook(req)
  }

  if (req.method === 'GET') {
    return jsonResponse({ ok: true, service: 'telegram-bot' })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (expected) {
      const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (got !== expected) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }
    }

    const update = await req.json()

    if (update?.callback_query) {
      return await handleCallback(update.callback_query)
    }

    const msg = update?.message
    const chatId = msg?.chat?.id
    const text = typeof msg?.text === 'string' ? msg.text : ''

    if (!chatId || !text) {
      return jsonResponse({ ok: true, skipped: true })
    }

    const bossId = String(Deno.env.get('TELEGRAM_BOSS_CHAT_ID') || '')
    if (!bossId || String(chatId) !== bossId) {
      return jsonResponse({ ok: true, ignored: true })
    }

    // Maxsus sana kutilayotgan bo'lsa — avval shuni tekshiramiz
    const pending = pendingDateByChat.get(String(chatId))
    if (pending && Date.now() - pending.ts <= PENDING_TTL_MS) {
      const parsed = parseDateRangeText(text)
      if (parsed) {
        const kind = takePending(chatId)
        const body = kind === 'expenses'
          ? await buildExpensesText(parsed)
          : await buildMonitoringText(parsed)
        await replyBoss(chatId, body, { withMenu: true })
        return jsonResponse({ ok: true, action: `${kind}:custom-date` })
      }
      // Sana emas — agar buyruq/tugma bo'lsa, pending ni bekor qilib davom etamiz
      if (
        isStart(text) ||
        isBalance(text) ||
        isMonitoring(text) ||
        isExpenses(text)
      ) {
        clearPending(chatId)
      } else {
        await replyBoss(
          chatId,
          'Sana formati noto\'g\'ri.\nMasalan: <code>31.07.2026</code> yoki <code>01.07.2026-31.07.2026</code>',
          { withMenu: true },
        )
        return jsonResponse({ ok: true, action: 'bad-date' })
      }
    }

    if (isStart(text)) {
      clearPending(chatId)
      await replyBoss(
        chatId,
        [
          '👋 <b>BM Auto Time</b>',
          '',
          'Pastdagi tugmalardan birini bosing:',
          '• 💰 <b>Balans</b> — joriy kassa',
          '• 📊 <b>Monitoring</b> — to\'lov va rasxotlar (sana tanlash)',
          '• 📤 <b>Rasxot</b> — rasxotlar ro\'yxati (sana tanlash)',
        ].join('\n'),
        { withMenu: true },
      )
      return jsonResponse({ ok: true, action: 'start' })
    }

    if (isBalance(text)) {
      clearPending(chatId)
      const body = await buildBalanceText()
      await replyBoss(chatId, body, { withMenu: true })
      return jsonResponse({ ok: true, action: 'balans' })
    }

    if (isMonitoring(text)) {
      await askPeriod(chatId, 'monitoring')
      return jsonResponse({ ok: true, action: 'monitoring-ask' })
    }

    if (isExpenses(text)) {
      await askPeriod(chatId, 'expenses')
      return jsonResponse({ ok: true, action: 'rasxot-ask' })
    }

    await replyBoss(
      chatId,
      'Tugmalardan foydalaning: 💰 Balans, 📊 Monitoring yoki 📤 Rasxot',
      { withMenu: true },
    )
    return jsonResponse({ ok: true, action: 'help' })
  } catch (e) {
    console.error('telegram-bot:', e)
    return jsonResponse({ ok: false, error: e?.message || 'Server xatosi' }, 200)
  }
})
