import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import DashboardHome from './DashboardHome'
import Students from './Students'
import Teachers from './Teachers'
import Payments from './Payments'
import Groups from './Groups'
import StudentDetail from './StudentDetail'
import Search from './Search'
import Reports from './Reports'
import Archive from './Archive'
import Admins from './Admins'

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

  const openStudent = (id, from) => {
    setSelectedStudentId(id)
    setPrevPage(from || 'students')
    setCurrentPage('student-detail')
  }

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <DashboardHome isBoss={isBoss} />
      case 'students': return <Students isBoss={isBoss} onStudentClick={(id) => openStudent(id, 'students')} />
      case 'teachers': return <Teachers isBoss={isBoss} />
      case 'payments': return <Payments isBoss={isBoss} session={session} openModal={openPayment} setOpenModal={setOpenPayment} />
      case 'groups': return <Groups isBoss={isBoss} />
      case 'search': return <Search onStudentClick={(id) => openStudent(id, 'search')} />
      case 'reports': return <Reports isBoss={isBoss} />
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
