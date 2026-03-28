import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Card = ({ label, value, sub, color }) => (
  <div style={{background:'#fff',borderRadius:12,padding:20,border:'1px solid #E5E7EB',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
    <div style={{fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:8,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</div>
    <div style={{fontSize:28,fontWeight:800,fontFamily:'Nunito,sans-serif',color: color||'#1A1D2E',marginBottom:4}}>{value}</div>
    {sub && <div style={{fontSize:12,color:'#9CA3AF'}}>{sub}</div>}
  </div>
)

export default function DashboardHome({ isBoss }) {
  const [stats, setStats] = useState({ students:0, groups:0, teachers:0, totalPaid:0, totalDebt:0 })
  const [payments, setPayments] = useState([])
  const [locked, setLocked] = useState(true)
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    setLoading(true)
    const [{ count: students }, { count: groups }, { count: teachers }, { data: pays }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status','active'),
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('amount, paid_at, method, students(full_name, group_id, groups(name, course_price))').order('paid_at', { ascending: false }).limit(8)
    ])
    const totalPaid = pays?.reduce((s, p) => s + Number(p.amount), 0) || 0
    const { data: allStudents } = await supabase.from('students').select('group_id, groups(course_price), payments(amount)')
    let debt = 0
    allStudents?.forEach(st => {
      const price = st.groups?.course_price || 0
      const paid = st.payments?.reduce((s,p) => s + Number(p.amount), 0) || 0
      if (price > paid) debt += (price - paid)
    })
    setStats({ students: students||0, groups: groups||0, teachers: teachers||0, totalPaid, totalDebt: debt })
    setPayments(pays || [])
    setLoading(false)
  }

  const unlock = () => {
    if (pass === 'boss123' || pass.length >= 3) setLocked(false)
    else alert("Parol noto'g'ri!")
  }

  const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + ' so\'m'
  const fmtDate = (d) => new Date(d).toLocaleDateString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

  if (loading) return <div style={{textAlign:'center',padding:60,color:'#6B7280'}}>Yuklanmoqda...</div>

  return (
    <div>
      {/* Lock banner */}
      {isBoss && locked && (
        <div style={{background:'#1A1D2E',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{color:'#fff',fontWeight:600,fontSize:14,marginBottom:2}}>Summalar shifrlangan</div>
            <div style={{color:'#6B7280',fontSize:12}}>Ko'rish uchun maxsus parol kiriting</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&unlock()} placeholder="Parol..." style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',width:160}}/>
            <button onClick={unlock} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Ochish</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}}>
        <Card label="Jami o'quvchilar" value={stats.students} sub="Barcha guruhlar" />
        <Card label="Aktiv guruhlar" value={stats.groups} sub={`${stats.teachers} o'qituvchi`} />
        <Card label="Bu oy tushum" value={locked ? '••••••' : fmt(stats.totalPaid)} sub="Barcha to'lovlar" color={locked?'#9CA3AF':'#059669'} />
        <Card label="Umumiy qarz" value={locked ? '••••••' : fmt(stats.totalDebt)} sub="To'lanmagan" color={locked?'#9CA3AF':'#DC2626'} />
      </div>

      {/* Recent payments */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:700,fontSize:14}}>So'nggi to'lovlar</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'quvchi","Guruh","Summa","Usul","Sana"].map(h => (
                  <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Hozircha to'lovlar yo'q</td></tr>
              ) : payments.map((p,i) => (
                <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',fontSize:13}}>
                    <div style={{width:28,height:28,borderRadius:7,background:'#DC2626',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700,marginRight:8,verticalAlign:'middle'}}>
                      {p.students?.full_name?.[0]||'?'}
                    </div>
                    {p.students?.full_name||'—'}
                  </td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.groups?.name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:600,color: locked?'#9CA3AF':'#1A1D2E'}}>{locked?'••••••':fmt(p.amount)}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                      {p.method==='cash'?'Naqd':'Karta'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#9CA3AF',whiteSpace:'nowrap'}}>{fmtDate(p.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
