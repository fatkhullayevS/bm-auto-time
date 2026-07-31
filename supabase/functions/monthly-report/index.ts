import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  assertCronAuth,
  fmtMoney,
  nowTashkent,
  previousMonthRange,
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

    const { start, end, label } = previousMonthRange()
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [
      { data: monthPays },
      { data: monthExps },
      { data: monthGas },
      { data: allPays },
      { data: allExps },
      { data: allGas },
    ] = await Promise.all([
      sb.from('payments').select('amount').gte('paid_at', startIso).lte('paid_at', endIso),
      sb.from('expenses')
        .select('amount, expense_categories(name)')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      sb.from('gas_allocations').select('amount').gte('allocated_at', startIso).lte('allocated_at', endIso),
      sb.from('payments').select('amount'),
      sb.from('expenses').select('amount'),
      sb.from('gas_allocations').select('amount'),
    ])

    const monthIncome = (monthPays || []).reduce((s, p) => s + Number(p.amount), 0)
    const monthGasAlloc = (monthGas || []).reduce((s, g) => s + Number(g.amount), 0)
    const monthExpense = (monthExps || []).reduce((s, e) => s + Number(e.amount), 0) + monthGasAlloc
    const balance =
      (allPays || []).reduce((s, p) => s + Number(p.amount), 0) -
      (allExps || []).reduce((s, e) => s + Number(e.amount), 0) -
      (allGas || []).reduce((s, g) => s + Number(g.amount), 0)

    const byCat: Record<string, number> = {}
    ;(monthExps || []).forEach((e) => {
      const name = e.expense_categories?.name || 'Umumiy'
      byCat[name] = (byCat[name] || 0) + Number(e.amount)
    })
    if (monthGasAlloc > 0) byCat['Gaz'] = (byCat['Gaz'] || 0) + monthGasAlloc
    const catLines = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sum]) => `• ${name}: ${fmtMoney(sum)} so'm`)

    const noActivity = monthIncome === 0 && monthExpense === 0

    let text: string
    if (noActivity) {
      text = [
        '📊 <b>OYLIK HISOBOT</b>',
        `🗓 ${label}`,
        '',
        'Bu oyda hech qanday harakat bo\'lmadi.',
        '',
        `💼 <b>Joriy kassa balansi:</b> ${fmtMoney(balance)} so'm`,
        `🕐 Hisobot vaqti: ${nowTashkent()}`,
      ].join('\n')
    } else {
      text = [
        '📊 <b>OYLIK HISOBOT</b>',
        `🗓 ${label}`,
        '',
        `💰 <b>Tushum:</b> ${fmtMoney(monthIncome)} so'm`,
        '',
        `📤 <b>Rasxotlar:</b> ${fmtMoney(monthExpense)} so'm`,
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
      income: monthIncome,
      expenses: monthExpense,
      balance,
    })
  } catch (e) {
    console.error('monthly-report:', e)
    return jsonResponse({ ok: false, error: e?.message || 'Server xatosi' }, 500)
  }
})
