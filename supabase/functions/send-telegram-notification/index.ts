import { handleCors, jsonResponse } from '../_shared/cors.ts'

function escapeHtml(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Raqam yoki allaqachon formatlangan string → "1 650 000" */
function fmt(n: unknown) {
  if (n === null || n === undefined || n === '') return '0'
  if (typeof n === 'string') {
    const cleaned = n.replace(/\s/g, '').replace(/so'm/gi, '').replace(/,/g, '')
    // allaqachon nuqta/bo'shliq bilan formatlangan bo'lsa — faqat raqamlarni olamiz
    const digits = cleaned.replace(/[^\d.-]/g, '')
    const num = Math.round(Number(digits) || 0)
    return new Intl.NumberFormat('uz-UZ').format(num)
  }
  return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0))
}

function nowTashkent() {
  return new Date().toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildMessage(type: string, data: Record<string, unknown>) {
  const when = nowTashkent()

  switch (type) {
    case 'payment': {
      const debt = Number(
        typeof data.remaining_debt === 'string'
          ? String(data.remaining_debt).replace(/[^\d.-]/g, '')
          : data.remaining_debt,
      ) || 0
      const debtLine = debt <= 0
        ? '✅ To\'liq to\'landi'
        : `⏳ Qolgan qarz: ${fmt(data.remaining_debt)} so'm`

      return [
        '💰 <b>YANGI TO\'LOV</b>',
        '',
        `👤 O'quvchi: ${escapeHtml(data.student_name)}`,
        `👥 Guruh: ${escapeHtml(data.group_name || '—')}`,
        `🧑‍🏫 O'qituvchi: ${escapeHtml(data.agent_name || data.teacher_name || '—')}`,
        `✅ To'landi: ${fmt(data.paid_amount)} so'm`,
        debtLine,
        `🕐 Vaqt: ${when}`,
      ].join('\n')
    }

    case 'general_payment':
      return [
        '💰 <b>UMUMIY TO\'LOV</b>',
        '',
        `🗓 Davr: ${escapeHtml(data.period || '—')}`,
        `✅ Summa: ${fmt(data.paid_amount)} so'm`,
        `💳 Usul: ${escapeHtml(data.method || '—')}`,
        data.notes ? `📝 Izoh: ${escapeHtml(data.notes)}` : null,
        `🕐 Vaqt: ${when}`,
      ].filter(Boolean).join('\n')

    case 'new_student':
      return [
        '🆕 <b>YANGI O\'QUVCHI QO\'SHILDI</b>',
        '',
        `👤 Ism: ${escapeHtml(data.student_name)}`,
        `👥 Guruh: ${escapeHtml(data.group_name || '—')}`,
        `🧑‍🏫 O'qituvchi: ${escapeHtml(data.agent_name || data.teacher_name || '—')}`,
        `💵 Kurs narxi: ${fmt(data.course_price)} so'm`,
        `🕐 Vaqt: ${when}`,
      ].join('\n')

    case 'expense':
      return [
        '📤 <b>YANGI RASXOT</b>',
        '',
        `📁 Kategoriya: ${escapeHtml(data.category_name)}`,
        `💵 Summa: ${fmt(data.amount)} so'm`,
        `📝 Izoh: ${escapeHtml(data.description || '—')}`,
        `👤 Kiritdi: ${escapeHtml(data.created_by_name || '—')}`,
        data.spent_at ? `🗓 Sana: ${escapeHtml(data.spent_at)}` : `🕐 Vaqt: ${when}`,
      ].join('\n')

    case 'general_expense':
      return [
        '📤 <b>UMUMIY RASXOT</b>',
        '',
        `🗓 Davr: ${escapeHtml(data.period || '—')}`,
        `💵 Summa: ${fmt(data.amount)} so'm`,
        data.description ? `📝 Izoh: ${escapeHtml(data.description)}` : null,
        `👤 Kiritdi: ${escapeHtml(data.created_by_name || '—')}`,
        `🕐 Vaqt: ${when}`,
      ].filter(Boolean).join('\n')

    default:
      return null
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const type = body?.type
    const data = body?.data || {}

    const text = buildMessage(type, data)
    if (!text) {
      return jsonResponse({ error: 'Noto\'g\'ri type' }, 400)
    }

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_BOSS_CHAT_ID')

    if (!token || !chatId) {
      console.error('TELEGRAM_BOT_TOKEN yoki TELEGRAM_BOSS_CHAT_ID sozlanmagan')
      return jsonResponse({ ok: false, skipped: true, reason: 'secrets_missing' }, 200)
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
      return jsonResponse({ ok: false, telegram: tgJson }, 200)
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    console.error('send-telegram-notification:', e)
    return jsonResponse({ ok: false, error: e?.message || 'Server xatosi' }, 200)
  }
})
