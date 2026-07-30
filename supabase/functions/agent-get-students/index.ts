import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { extractAgentToken, verifyAgentToken } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    let token = extractAgentToken(req)
    if (!token) {
      const body = await req.json().catch(() => ({}))
      token = body?.token || null
    }

    if (!token) {
      return jsonResponse({ error: 'Agent token kerak' }, 401)
    }

    const payload = await verifyAgentToken(token)
    const sb = serviceClient()

    const { data: agent } = await sb
      .from('agents')
      .select('id, is_active')
      .eq('id', payload.agent_id)
      .maybeSingle()

    if (!agent || agent.is_active === false) {
      return jsonResponse({ error: 'Hisob bloklangan yoki topilmadi' }, 403)
    }

    const { data: students, error } = await sb
      .from('students')
      .select('id, full_name, phone, course_price, group_id, created_at, groups(name), payments(amount, paid_at, method)')
      .eq('agent_id', payload.agent_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return jsonResponse({ error: error.message }, 500)
    }

    const list = (students || []).map((st) => {
      const paid = (st.payments || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
      const debt = Math.max(0, (st.course_price || 0) - paid)
      return {
        id: st.id,
        full_name: st.full_name,
        phone: st.phone,
        course_price: st.course_price,
        group_name: st.groups?.name || null,
        paid,
        debt,
        payments: st.payments || [],
      }
    })

    return jsonResponse({
      agent_id: payload.agent_id,
      full_name: payload.full_name,
      students: list,
    })
  } catch (e) {
    console.error(e)
    const msg = e?.message || 'Server xatosi'
    const status = /token|signature|expired|Invalid/i.test(msg) ? 401 : 500
    return jsonResponse({ error: msg }, status)
  }
})
