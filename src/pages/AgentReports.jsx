import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { checkDeletePassword } from '../lib/checkPassword'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

export default function AgentReports({ isBoss }) {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentData, setAgentData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [locked, setLocked] = useState(true)
  const [pass, setPass] = useState('')
  const [showDebtDetail, setShowDebtDetail] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadAgents() }, [])
  useEffect(() => { if (selectedAgent) loadAgentData(selectedAgent) }, [selectedAgent, period])

  const loadAgents = async () => {
    setLoading(true)
    const { data } = await supabase.from('agents').select('id, full_name, phone').order('full_name')
    setAgents(data || [])
    setLoading(false)
  }

  const loadAgentData = async (agent) => {
    setLoading(true)

    // Faol o'quvchilar va ularning to'lovlari
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, course_price, payments(id, amount, method, paid_at, cashier_id, profiles(full_name))')
      .eq('agent_id', agent.id)

    // Arxivlangan to'lovlar logi
    const { data: logs } = await supabase
      .from('agent_payments_log')
      .select('*')
      .eq('agent_id', agent.id)
      .order('paid_at', { ascending: false })

    // Period filtri
    const now = new Date()
    const filterByPeriod = (date) => {
      const d = new Date(date)
      if (period === 'week') return (now - d) <= 7 * 24 * 60 * 60 * 1000
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      return true
    }

    // Faol o'quvchilardan to'lovlar
    let allPayments = []
    let totalExpected = 0
    let debtStudents = []

    students?.forEach(st => {
      const paid = st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
      const debt = Math.max(0, (st.course_price||0) - paid)
      totalExpected += st.course_price || 0
      if (debt > 0) debtStudents.push({ ...st, paid, debt })
      st.payments?.forEach(p => {
        if (filterByPeriod(p.paid_at)) {
          allPayments.push({ ...p, student_name: st.full_name, source: 'active' })
        }
      })
    })

    // Arxivlangan to'lovlar
    logs?.forEach(log => {
      if (filterByPeriod(log.paid_at)) {
        allPayments.push({ ...log, source: 'archived' })
      }
    })

    allPayments.sort((a,b) => new Date(b.paid_at) - new Date(a.paid_at))

    const totalPaid = allPayments.reduce((s,p) => s+Number(p.amount), 0)
    const totalDebt = debtStudents.reduce((s,st) => s+st.debt, 0)

    setAgentData({ students, allPayments, totalExpected, totalPaid, totalDebt, debtStudents, logs })
    setLoading(false)
  }

  const unlock = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key','view_password').single()
    if (data?.value === pass) { setLocked(false); setPass('') }
    else alert("Parol noto'g'ri!")
  }

  const openDelete = (item, type) => {
    setDeleteItem({ ...item, type })
    setDeletePass('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const ok = await checkDeletePassword(deletePass)
    if (!ok) return alert("Parol noto'g'ri!")
    setDeleting(true)
    if (deleteItem.type === 'payment') {
      await supabase.from('payments').delete().eq('id', deleteItem.id)
    } else if (deleteItem.type === 'log') {
      await supabase.from('agent_payments_log').delete().eq('id', deleteItem.id)
    }
    setShowDeleteModal(false)
    loadAgentData(selectedAgent)
    setDeleting(false)
  }

  const hide = (val) => locked ? '••••••' : val

  // Agents list
  if (!selectedAgent) {
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

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center',color:'#9CA3AF'}}>Yuklanmoqda...</div>
          ) : agents.map(a => (
            <div key={a.id} onClick={() => setSelectedAgent(a)} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,.06)',transition:'all .15s'}} onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'} onMouseOut={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:42,height:42,borderRadius:10,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>{a.full_name[0]}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>{a.full_name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>{a.phone||"Telefon yo'q"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Agent detail
  return (
    <div>
      <button onClick={() => { setSelectedAgent(null); setAgentData(null) }} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit',padding:0}}>
        ← Orqaga
      </button>

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

      {/* Agent info */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{width:48,height:48,borderRadius:12,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20,flexShrink:0}}>{selectedAgent.full_name[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18}}>{selectedAgent.full_name}</div>
            <div style={{fontSize:13,color:'#9CA3AF'}}>{selectedAgent.phone||"Telefon yo'q"}</div>
          </div>
          {/* Period filter */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {[{val:'all',label:'Barchasi'},{val:'month',label:'Bu oy'},{val:'week',label:'Bu hafta'}].map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)} style={{padding:'6px 12px',borderRadius:7,border:`1.5px solid ${period===p.val?'#DC2626':'#E5E7EB'}`,background:period===p.val?'#FEF2F2':'#fff',color:period===p.val?'#DC2626':'#6B7280',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {agentData && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
            {[
              { label:"O'quvchilar", val: (agentData.students?.length||0) + ' ta' },
              { label:'Kutilgan', val: hide(fmt(agentData.totalExpected)), color: locked?'#9CA3AF':'#1A1D2E' },
              { label:'Tushgan', val: hide(fmt(agentData.totalPaid)), color: locked?'#9CA3AF':'#059669' },
              { label:'Qarz', val: hide(fmt(agentData.totalDebt)), color: locked?'#9CA3AF':agentData.totalDebt>0?'#DC2626':'#9CA3AF' },
            ].map((item,i) => (
              <div key={i} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:10,color:'#9CA3AF',marginBottom:3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:item.color||'#1A1D2E'}}>{item.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debt detail */}
      {agentData?.debtStudents?.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)',marginBottom:16}}>
          <div onClick={() => setShowDebtDetail(!showDebtDetail)} style={{padding:'14px 18px',borderBottom:showDebtDetail?'1px solid #F3F4F6':'none',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
            <span style={{fontWeight:700,fontSize:14,color:'#DC2626'}}>Qarzlar ({agentData.debtStudents.length} ta o'quvchi)</span>
            <span style={{color:'#9CA3AF',fontSize:18}}>{showDebtDetail?'▲':'▼'}</span>
          </div>
          {showDebtDetail && agentData.debtStudents.map((st,i) => (
            <div key={i} style={{padding:'12px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>{st.full_name}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>To'langan: {hide(fmt(st.paid))}</div>
              </div>
              <span style={{padding:'3px 10px',borderRadius:5,fontSize:12,fontWeight:600,background:'#FEF2F2',color:'#DC2626'}}>{hide(fmt(st.debt))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payments list */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6'}}>
          <span style={{fontWeight:700,fontSize:14}}>To'lovlar tarixi</span>
        </div>
        {!agentData || agentData.allPayments.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>To'lovlar yo'q</div>
        ) : agentData.allPayments.map((p,i) => (
          <div key={i} style={{padding:'14px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
            <div style={{flex:1,minWidth:120}}>
              <div style={{fontSize:13,fontWeight:600}}>{p.student_name||p.student_name||'—'}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{fmtDate(p.paid_at)}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:14,fontWeight:700,color:locked?'#9CA3AF':'#059669'}}>{hide(fmt(p.amount))}</span>
              <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                {p.method==='cash'?'Naqd':'Karta'}
              </span>
              {p.source === 'archived' && <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:600,background:'#F3F4F6',color:'#6B7280'}}>Arxiv</span>}
              {isBoss && (
                <button onClick={() => openDelete(p, p.source==='archived'?'log':'payment')} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',color:'#DC2626',fontFamily:'inherit'}}>
                  O'chirish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:8}}>To'lovni o'chirish</h2>
            <p style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Bu amalni qaytarib bo'lmaydi. Maxsus parolni kiriting.</p>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Maxsus parol</label>
              <input type="password" value={deletePass} onChange={e=>setDeletePass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmDelete()} placeholder="Parol kiriting..." style={{width:'100%',padding:'9px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setShowDeleteModal(false)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={confirmDelete} disabled={deleting} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {deleting?"O'chirilmoqda...":"O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
