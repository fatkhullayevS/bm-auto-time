import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import DashboardHome from './DashboardHome'
import Students from './Students'
import Agents from './Agents'
import Payments from './Payments'
import Groups from './Groups'
import StudentDetail from './StudentDetail'
import Search from './Search'
import Reports from './Reports'
import AgentReports from './AgentReports'
import Archive from './Archive'
import Admins from './Admins'
import Expenses from './Expenses'
import Gas from './Gas'

export default function Dashboard({ session }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [openPayment, setOpenPayment] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [prevPage, setPrevPage] = useState('students')

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const isBoss = profile?.role === 'boss'
  const canManageAgents = ['boss', 'kassir', 'cashier'].includes(profile?.role)
  const canWriteExpenses = ['boss', 'kassir', 'cashier'].includes(profile?.role)

  const openStudent = (id, from) => {
    setSelectedStudentId(id)
    setPrevPage(from || 'students')
    setCurrentPage('student-detail')
  }

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <DashboardHome isBoss={isBoss} />
      case 'students': return <Students isBoss={isBoss} onStudentClick={(id) => openStudent(id, 'students')} />
      case 'agents': return <Agents isBoss={isBoss} canManageAgents={canManageAgents} onStudentClick={(id) => openStudent(id, 'agents')} />
      case 'payments': return <Payments isBoss={isBoss} session={session} openModal={openPayment} setOpenModal={setOpenPayment} />
      case 'expenses': return <Expenses session={session} canWrite={canWriteExpenses} />
      case 'gas': return <Gas session={session} canWrite={canWriteExpenses} isBoss={isBoss} />
      case 'groups': return <Groups isBoss={isBoss} onStudentClick={(id) => openStudent(id, 'groups')} />
      case 'search': return <Search onStudentClick={(id) => openStudent(id, 'search')} />
      case 'reports': return <Reports isBoss={isBoss} />
      case 'agent-reports': return <AgentReports isBoss={isBoss} />
      case 'archive': return <Archive />
      case 'admins': return <Admins />
      case 'student-detail': return <StudentDetail studentId={selectedStudentId} onBack={() => setCurrentPage(prevPage)} isBoss={isBoss} />
      default: return (
        <div style={{textAlign:'center',padding:60,color:'#9CA3AF',fontSize:14}}>
          Bu sahifa tez orada qo'shiladi...
        </div>
      )
    }
  }

  const handlePaymentClick = () => {
    setCurrentPage('payments')
    setOpenPayment(true)
  }

  return (
    <Layout session={session} currentPage={currentPage} setCurrentPage={setCurrentPage} onPaymentClick={handlePaymentClick}>
      {renderPage()}
    </Layout>
  )
}
