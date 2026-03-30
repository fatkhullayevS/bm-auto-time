import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

export default function Reports({ isBoss }) {
  const [payments, setPayments] = useState([])
  const [agents, setAgents] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(true)
  const [pass, setPass] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterMethod, setFilterMethod] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: pays }, { data: ag }, { data: st }] = await Promise.all([
      supabase.from('payments').select('*, students(full_name, course_price, agent_id, groups(name), agents(id, full_name))').order('paid_at', { ascending: false }),
      supabase.from('agents').select('id, full_name'),
      supabase.from('students').select('id, course_price, payments(amount)')
    ])
    setPayments(pays || [])
    setAgents(ag || [])
    setStudents(st || [])
    setLoading(false)
  }

  const unlock = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key','view_password').single()
    if (data?.value === pass) { setLocked(false); setPass('') }
    else alert("Parol noto'g'ri!")
  }

  const filtered = payments.filter(p => {
    if (filterAgent && p.students?.agents?.id !== filterAgent) return false
    if (filterMethod && p.method !== filterMethod) return false
    if (dateFrom && new Date(p.paid_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(p.paid_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalPaid = filtered.reduce((s,p) => s+Number(p.amount), 0)
  const totalCash = filtered.filter(p=>p.method==='cash').reduce((s,p) => s+Number(p.amount), 0)
  const totalCard = filtered.filter(p=>p.method==='card').reduce((s,p) => s+Number(p.amount), 0)

  const totalDebt = students.reduce((s,st) => {
    const paid = st.payments?.reduce((ss,p) => ss+Number(p.amount), 0) || 0
    return s + Math.max(0, (st.course_price||0) - paid)
  }, 0)

  const hide = (val) => locked ? '••••••' : val

  const downloadCSV = () => {
    if (locked) return alert("Avval parolni kiriting!")
    const rows = [["O'quvchi","Guruh","Ma'sul","Summa","Usul","Sana"]]
    filtered.forEach(p => {
      rows.push([
        p.students?.full_name||'',
        p.students?.groups?.name||'',
        p.students?.agents?.full_name||'',
        p.amount,
        p.method==='cash'?'Naqd':'Karta',
        fmtDate(p.paid_at)
      ])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'hisobot.csv'; a.click()
  }

  return (
    <div>
      {locked && (
        <div style={{background:'#1A1D2E',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160}}>
            <div style={{color:'#fff',fontWeight:600,fontSize:14,marginBottom:2}}>Summalar shifrlangan</div>
            <div style={{color:'#6B7280',fontSize:12}}>Ko'rish uchun maxsus parol kiriting</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&unlock()} placeholder="Parol..." style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',width:150}}/>
            <button onClick={unlock} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Ochish</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:'16px 20px',marginBottom:16,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        <span style={{color:'#9CA3AF',fontSize:13}}>dan</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        <span style={{color:'#9CA3AF',fontSize:13}}>gacha</span>
        <select value={filterAgent} onChange={e=>setFilterAgent(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha ma'sullar</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha usullar</option>
          <option value="cash">Naqd</option>
          <option value="card">Karta</option>
        </select>
        {(dateFrom||dateTo||filterAgent||filterMethod) && (
          <button onClick={()=>{setDateFrom('');setDateTo('');setFilterAgent('');setFilterMethod('')}} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',color:'#6B7280'}}>Tozalash ×</button>
        )}
        <button onClick={downloadCSV} style={{marginLeft:'auto',background:'#1A1D2E',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          CSV yuklab olish
        </button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>
        {[
          { label:'Jami tushum', val: hide(fmt(totalPaid)), color:'#1A1D2E' },
          { label:'Naqd', val: hide(fmt(totalCash)), color:'#059669' },
          { label:'Karta', val: hide(fmt(totalCard)), color:'#4338CA' },
          { label:"To'lovlar soni", val: filtered.length + ' ta', color:'#1A1D2E' },
          { label:'Umumiy qarz', val: hide(fmt(totalDebt)), color: totalDebt>0?'#DC2626':'#9CA3AF' },
        ].map((item,i) => (
          <div key={i} style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #E5E7EB',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#6B7280',marginBottom:6,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
            <div style={{fontSize:20,fontWeight:800,fontFamily:'Nunito,sans-serif',color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:700,fontSize:14}}>To'lovlar ({filtered.length} ta)</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'quvchi","Guruh","Ma'sul","Summa","Usul","Sana"].map((h,i) => (
                  <th key={i} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Ma'lumot yo'q</td></tr>
              ) : filtered.map((p,i) => (
                <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:600}}>{p.students?.full_name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.groups?.name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.agents?.full_name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:600,color:locked?'#9CA3AF':'#1A1D2E'}}>{hide(fmt(p.amount))}</td>
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
