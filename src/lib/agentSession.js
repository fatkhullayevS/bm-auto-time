const STORAGE_KEY = 'agent_session'

/**
 * @typedef {{ token: string, agent: { id: string, full_name: string, login?: string } }} AgentSession
 */

/** @returns {AgentSession | null} */
export function getAgentSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.token || !data?.agent?.id) return null
    return data
  } catch {
    return null
  }
}

/** @param {AgentSession} session */
export function setAgentSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearAgentSession() {
  localStorage.removeItem(STORAGE_KEY)
}
