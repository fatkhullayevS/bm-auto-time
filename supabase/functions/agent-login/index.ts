import bcrypt from 'npm:bcryptjs@2.4.3'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { signAgentToken } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { login, password } = await req.json()
    if (!login?.trim() || !password) {
      return jsonResponse({ error: 'Login va parol kerak' }, 400)
    }

    const sb = serviceClient()
    const { data: agent, error } = await sb
      .from('agents')
      .select('id, full_name, password_hash, is_active, login')
      .eq('login', login.trim())
      .maybeSingle()

    if (error) {
      console.error(error)
      return jsonResponse({ error: 'Server xatosi' }, 500)
    }

    if (!agent || !agent.password_hash) {
      return jsonResponse({ error: "Login yoki parol noto'g'ri" }, 401)
    }

    if (agent.is_active === false) {
      return jsonResponse({ error: "Bu hisob bloklangan. Admin bilan bog'laning." }, 403)
    }

    const match = await bcrypt.compare(password, agent.password_hash)
    if (!match) {
      return jsonResponse({ error: "Login yoki parol noto'g'ri" }, 401)
    }

    const token = await signAgentToken(agent.id, agent.full_name)

    return jsonResponse({
      token,
      agent: {
        id: agent.id,
        full_name: agent.full_name,
        login: agent.login,
      },
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e?.message || 'Server xatosi' }, 500)
  }
})
