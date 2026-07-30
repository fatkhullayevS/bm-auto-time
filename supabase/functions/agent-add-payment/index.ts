import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { extractAgentToken, verifyAgentToken } from '../_shared/jwt.ts'
import { fmtMoney, nowTashkent, sendTelegramMessage } from '../_shared/telegram.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    let token = extractAgentToken(req) || body?.token || null
    if (!token) {
      return jsonResponse({ error: 'Agent token kerak' }, 401)
    }

    const { student_id, amount, method = 'cash', notes = '' } = body
    if (!student_id) {
      return jsonResponse({ error: "O'quvchi tanlang" }, 400)
    }
    if (!amount || Number(amount) <= 0) {
      return jsonResponse({ error: 'Summa noto‘g‘ri' }, 400)
    }

    const payload = await verifyAgentToken(token)
    const sb = serviceClient()

    const { data: agent } = await sb
      .from('agents')
      .select('id, full_name, is_active')
      .eq('id', payload.agent_id)
      .maybeSingle()

    if (!agent || agent.is_active === false) {
      return jsonResponse({ error: 'Hisob bloklangan yoki topilmadi' }, 403)
    }

    const { data: student, error: stErr } = await sb
      .from('students')
      .select('id, full_name, agent_id, course_price, groups(name), payments(amount)')
      .eq('id', student_id)
      .maybeSingle()

    if (stErr || !student) {
      return jsonResponse({ error: "O'quvchi topilmadi" }, 404)
    }

    if (student.agent_id !== payload.agent_id) {
      return jsonResponse({ error: "Bu o'quvchi sizga biriktirilmagan" }, 403)
    }

    const paidAt = new Date().toISOString()
    const amountNum = Number(amount)
    const { data: payment, error: payErr } = await sb
      .from('payments')
      .insert([{
        student_id,
        amount: amountNum,
        method,
        notes: notes || `Ma'sul: ${agent.full_name}`,
        paid_at: paidAt,
      }])
      .select('id, amount, method, paid_at')
      .single()

    if (payErr) {
      console.error(payErr)
      return jsonResponse({ error: payErr.message }, 500)
    }

    const { error: logErr } = await sb.from('agent_payments_log').insert([{
      agent_id: payload.agent_id,
      payment_id: payment.id,
      student_name: student.full_name,
      amount: amountNum,
      method,
      paid_at: paidAt,
    }])

    if (logErr) {
      console.error('agent_payments_log insert:', logErr)
    }

    // Bossga Telegram — ma'sul "O'qituvchi" sifatida
    try {
      const alreadyPaid = (student.payments || []).reduce((s, p) => s + Number(p.amount), 0)
      const remaining = Math.max(0, (student.course_price || 0) - alreadyPaid - amountNum)
      const debtLine = remaining <= 0
        ? '✅ To\'liq to\'landi'
        : `⏳ Qolgan qarz: ${fmtMoney(remaining)} so'm`
      const groupName = student.groups?.name || '—'
      const text = [
        '💰 <b>YANGI TO\'LOV</b>',
        '',
        `👤 O'quvchi: ${student.full_name}`,
        `👥 Guruh: ${groupName}`,
        `🧑‍🏫 O'qituvchi: ${agent.full_name}`,
        `✅ To'landi: ${fmtMoney(amountNum)} so'm`,
        debtLine,
        `🕐 Vaqt: ${nowTashkent()}`,
      ].join('\n')
      await sendTelegramMessage(text)
    } catch (tgErr) {
      console.error('Telegram notify (agent payment):', tgErr)
    }

    return jsonResponse({
      ok: true,
      payment,
      student: {
        id: student.id,
        full_name: student.full_name,
        group_name: student.groups?.name || null,
      },
    })
  } catch (e) {
    console.error(e)
    const msg = e?.message || 'Server xatosi'
    const status = /token|signature|expired|Invalid/i.test(msg) ? 401 : 500
    return jsonResponse({ error: msg }, status)
  }
})
