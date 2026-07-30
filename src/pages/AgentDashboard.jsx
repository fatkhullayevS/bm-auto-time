import AgentLayout from '../components/AgentLayout'
import AgentStudents from './AgentStudents'

export default function AgentDashboard({ agentSession, onLogout }) {
  return (
    <AgentLayout agent={agentSession?.agent} onLogout={onLogout}>
      <AgentStudents />
    </AgentLayout>
  )
}
