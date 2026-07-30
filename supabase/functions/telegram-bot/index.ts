import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import {
  assertCronAuth,
  bossMenuKeyboard,
  escapeHtml,
  fmtMoney,
  nowTashkent,
  sendTelegramMessage,
  todayTashkentRange,
} from '../_shared/telegram.ts'

const MAX_LINES = 25

function normalizeCmd(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[💰📊]/g, '')
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

function isStart(text: string) {
  const t = normalizeCmd(text)
  return t === '/start' || t.startsWith('/start@') || t === 'menu' || t === '/menu'
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

async function buildMonitoringText() {
  const sb = serviceClient()
  const { start, end, label } = todayTashkentRange()
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const [{ data: pays }, { data: exps }] = await Promise.all([
    sb
      .from('payments')
      .select('amount, method, paid_at, students(full_name), notes')
      .gte('paid_at', startIso)
      .lte('paid_at', endIso)
      .order('paid_at', { ascending: false }),
    sb
      .from('expenses')
      .select('amount, description, created_at, expense_categories(name)')
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
    const name = escapeHtml(p.students?.full_name || '—')
    const method = escapeHtml(p.method || '—')
    return `• ${name} — ${fmtMoney(p.amount)} (${method})`
  })
  if (payments.length > MAX_LINES) {
    payLines.push(`… va yana ${payments.length - MAX_LINES} ta`)
  }

  const expLines = expenses.slice(0, MAX_LINES).map((e) => {
    const cat = escapeHtml(e.expense_categories?.name || 'Boshqa')
    const desc = e.description ? ` — ${escapeHtml(e.description)}` : ''
    return `• ${cat}: ${fmtMoney(e.amount)}${desc}`
  })
  if (expenses.length > MAX_LINES) {
    expLines.push(`… va yana ${expenses.length - MAX_LINES} ta`)
  }

  if (payments.length === 0 && expenses.length === 0) {
    return [
      '📊 <b>BUGUNGI MONITORING</b>',
      `🗓 ${label}`,
      '',
      'Bugun hali to\'lov yoki rasxot yo\'q.',
      `🕐 ${nowTashkent()}`,
    ].join('\n')
  }

  return [
    '📊 <b>BUGUNGI MONITORING</b>',
    `🗓 ${label}`,
    '',
    `💰 <b>TO'LOVLAR</b> (${payments.length} ta): ${fmtMoney(income)} so'm`,
    ...(payLines.length ? payLines : ['• Yo\'q']),
    '',
    `📤 <b>RASXOTLAR</b> (${expenses.length} ta): ${fmtMoney(expenseSum)} so'm`,
    ...(expLines.length ? expLines : ['• Yo\'q']),
    '',
    `📈 Kunlik farq: ${dayDiff >= 0 ? '+' : ''}${fmtMoney(dayDiff)} so'm`,
    `🕐 ${nowTashkent()}`,
  ].join('\n')
}

async function replyBoss(chatId: string | number, text: string, withMenu = false) {
  await sendTelegramMessage(text, {
    chatId,
    replyMarkup: withMenu ? bossMenuKeyboard() : undefined,
  })
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
  // Ixtiyoriy alohida secret (CRON_SECRET bilan aralashtirmaymiz)
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || ''

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }
  if (secret) body.secret_token = secret

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const tgJson = await tgRes.json().catch(() => ({}))

  // Menu buyruqlarini BotFather stilida ko'rsatish
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Menu ochish' },
        { command: 'balans', description: 'Kassa balansi' },
        { command: 'monitoring', description: 'Bugungi to\'lov va rasxotlar' },
      ],
    }),
  }).catch(() => {})

  return jsonResponse({ ok: tgJson.ok === true, webhook: webhookUrl, telegram: tgJson })
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)

  // Setup (bir marta)
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
    // Ixtiyoriy: faqat TELEGRAM_WEBHOOK_SECRET o'rnatilgan bo'lsa tekshiramiz
    const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (expected) {
      const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (got !== expected) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }
    }

    const update = await req.json()
    const msg = update?.message
    const chatId = msg?.chat?.id
    const text = typeof msg?.text === 'string' ? msg.text : ''

    if (!chatId || !text) {
      return jsonResponse({ ok: true, skipped: true })
    }

    const bossId = String(Deno.env.get('TELEGRAM_BOSS_CHAT_ID') || '')
    if (!bossId || String(chatId) !== bossId) {
      // Boshqa odam yozsa — javob bermaymiz
      return jsonResponse({ ok: true, ignored: true })
    }

    if (isStart(text)) {
      await replyBoss(
        chatId,
        [
          '👋 <b>BM Auto Time</b>',
          '',
          'Pastdagi tugmalardan birini bosing:',
          '• 💰 <b>Balans</b> — joriy kassa',
          '• 📊 <b>Monitoring</b> — bugungi to\'lov va rasxotlar',
        ].join('\n'),
        true,
      )
      return jsonResponse({ ok: true, action: 'start' })
    }

    if (isBalance(text)) {
      const body = await buildBalanceText()
      await replyBoss(chatId, body, true)
      return jsonResponse({ ok: true, action: 'balans' })
    }

    if (isMonitoring(text)) {
      const body = await buildMonitoringText()
      await replyBoss(chatId, body, true)
      return jsonResponse({ ok: true, action: 'monitoring' })
    }

    // Noma'lum matn — menuni qayta ko'rsatamiz
    await replyBoss(
      chatId,
      'Tugmalardan foydalaning: 💰 Balans yoki 📊 Monitoring',
      true,
    )
    return jsonResponse({ ok: true, action: 'help' })
  } catch (e) {
    console.error('telegram-bot:', e)
    // Telegram qayta urinmasligi uchun 200
    return jsonResponse({ ok: false, error: e?.message || 'Server xatosi' }, 200)
  }
})
