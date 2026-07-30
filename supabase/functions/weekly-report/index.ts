import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  assertCronAuth,
  fmtMoney,
  nowTashkent,
  previousWeekRange,
  sendTelegramMessage,
} from '../_shared/telegram.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!assertCronAuth(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { start, end, label } = previousWeekRange()
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [
      { data: weekPays },
      { data: weekExps },
      { data: allPays },
      { data: allExps },
    ] = await Promise.all([
      sb.from('payments').select('amount').gte('paid_at', startIso).lte('paid_at', endIso),
      sb.from('expenses')
        .select('amount, expense_categories(name)')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      sb.from('payments').select('amount'),
      sb.from('expenses').select('amount'),
    ])

    const weekIncome = (weekPays || []).reduce((s, p) => s + Number(p.amount), 0)
    const weekExpense = (weekExps || []).reduce((s, e) => s + Number(e.amount), 0)
    const balance =
      (allPays || []).reduce((s, p) => s + Number(p.amount), 0) -
      (allExps || []).reduce((s, e) => s + Number(e.amount), 0)

    const byCat: Record<string, number> = {}
    ;(weekExps || []).forEach((e) => {
      const name = e.expense_categories?.name || 'Boshqa'
      byCat[name] = (byCat[name] || 0) + Number(e.amount)
    })
    const catLines = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sum]) => `• ${name}: ${fmtMoney(sum)} so'm`)

    const noActivity = weekIncome === 0 && weekExpense === 0

    let text: string
    if (noActivity) {
      text = [
        '📊 <b>HAFTALIK HISOBOT</b>',
        `🗓 ${label}`,
        '',
        'Bu hafta hech qanday harakat bo\'lmadi.',
        '',
        `💼 <b>Joriy kassa balansi:</b> ${fmtMoney(balance)} so'm`,
        `🕐 Hisobot vaqti: ${nowTashkent()}`,
      ].join('\n')
    } else {
      text = [
        '📊 <b>HAFTALIK HISOBOT</b>',
        `🗓 ${label}`,
        '',
        `💰 <b>Tushum:</b> ${fmtMoney(weekIncome)} so'm`,
        '',
        `📤 <b>Rasxotlar:</b> ${fmtMoney(weekExpense)} so'm`,
        ...(catLines.length ? catLines : ['• Rasxot yo\'q']),
        '',
        `💼 <b>Joriy kassa balansi:</b> ${fmtMoney(balance)} so'm`,
        '',
        `🕐 Hisobot vaqti: ${nowTashkent()}`,
      ].join('\n')
    }

    await sendTelegramMessage(text)

    return jsonResponse({
      ok: true,
      period: label,
      income: weekIncome,
      expenses: weekExpense,
      balance,
    })
  } catch (e) {
    console.error('weekly-report:', e)
    return jsonResponse({ ok: false, error: e?.message || 'Server xatosi' }, 500)
  }
})
