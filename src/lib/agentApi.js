import { supabase } from './supabase'
import { getAgentSession } from './agentSession'

const functionsUrl = () => {
  const base = import.meta.env.VITE_SUPABASE_URL
  return `${base}/functions/v1`
}

async function invoke(name, { body = {}, agentToken = null, withUserAuth = false } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }

  if (agentToken) {
    headers['x-agent-token'] = agentToken
    headers.Authorization = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  } else if (withUserAuth) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { data: null, error: 'Sessiya topilmadi. Qayta kiring.' }
    }
    headers.Authorization = `Bearer ${session.access_token}`
  } else {
    headers.Authorization = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  }

  const res = await fetch(`${functionsUrl()}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  let json = null
  try {
    json = await res.json()
  } catch {
    return { data: null, error: 'Server javobi o‘qilmadi' }
  }

  if (!res.ok) {
    return { data: null, error: json?.error || `Xato (${res.status})` }
  }
  return { data: json, error: null }
}

export async function agentLogin(login, password) {
  return invoke('agent-login', { body: { login, password } })
}

export async function agentSetPassword(agentId, newPassword, login) {
  const body = { agent_id: agentId, new_password: newPassword }
  if (login !== undefined) body.login = login
  return invoke('agent-set-password', { body, withUserAuth: true })
}

export async function agentGetStudents() {
  const session = getAgentSession()
  if (!session?.token) return { data: null, error: 'Agent sessiyasi yo‘q' }
  return invoke('agent-get-students', {
    body: { token: session.token },
    agentToken: session.token,
  })
}

export async function agentAddPayment({ studentId, amount, method, notes }) {
  const session = getAgentSession()
  if (!session?.token) return { data: null, error: 'Agent sessiyasi yo‘q' }
  return invoke('agent-add-payment', {
    body: {
      token: session.token,
      student_id: studentId,
      amount,
      method,
      notes,
    },
    agentToken: session.token,
  })
}
