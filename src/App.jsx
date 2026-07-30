import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getAgentSession, clearAgentSession } from './lib/agentSession'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AgentDashboard from './pages/AgentDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [agentSession, setAgentSessionState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getAgentSession()
    if (stored) setAgentSessionState(stored)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        clearAgentSession()
        setAgentSessionState(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        Yuklanmoqda...
      </div>
    )
  }

  // Staff session ustun (Supabase Auth)
  if (session) {
    return <Dashboard session={session} />
  }

  // Agent custom session
  if (agentSession) {
    return (
      <AgentDashboard
        agentSession={agentSession}
        onLogout={() => setAgentSessionState(null)}
      />
    )
  }

  return (
    <Login
      onAgentLogin={(s) => setAgentSessionState(s)}
    />
  )
}
