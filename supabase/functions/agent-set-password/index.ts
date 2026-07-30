import bcrypt from 'npm:bcryptjs@2.4.3'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { requireStaff } from '../_shared/staff.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const staff = await requireStaff(req)
    if ('error' in staff && staff.error) {
      return jsonResponse({ error: staff.error }, staff.status)
    }

    const { agent_id, new_password, login } = await req.json()
    if (!agent_id) {
      return jsonResponse({ error: 'agent_id kerak' }, 400)
    }
    if (!new_password || String(new_password).length < 4) {
      return jsonResponse({ error: "Parol kamida 4 belgidan iborat bo'lsin" }, 400)
    }

    const hash = await bcrypt.hash(String(new_password), 10)
    const sb = serviceClient()

    const update: Record<string, unknown> = { password_hash: hash }
    if (login !== undefined && login !== null) {
      const trimmed = String(login).trim()
      if (!trimmed) {
        return jsonResponse({ error: "Login bo'sh bo'lmasin" }, 400)
      }
      update.login = trimmed
    }

    const { data, error } = await sb
      .from('agents')
      .update(update)
      .eq('id', agent_id)
      .select('id, full_name, login, is_active')
      .single()

    if (error) {
      if (error.code === '23505') {
        return jsonResponse({ error: 'Bu login band' }, 409)
      }
      console.error(error)
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({
      ok: true,
      agent: data,
      message: "Parol muvaffaqiyatli o'rnatildi",
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e?.message || 'Server xatosi' }, 500)
  }
})
