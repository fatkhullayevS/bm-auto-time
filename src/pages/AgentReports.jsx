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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [showDebtDetail, setShowDebtDetail] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadAgents() }, [])
  useEffect(() => { if (selectedAgent) loadAgentData(selectedAgent) }, [selectedAgent, dateFrom, dateTo, filterMethod])

  const loadAgents = async () => {
    setLoading(true)
    const { data } = await supabase.from('agents').select('id, full_name, phone').order('full_name')
    setAgents(data || [])
    setLoading(false)
  }

  const loadAgentData = async (agent) => {
    setLoading(true)

    // Faqat agent_payments_log dan o'qiymiz
    const { data: logs } = await supabase
      .from('agent_payments_log')
      .select('*')
      .eq('agent_id', agent.id)
      .order('paid_at', { ascending: false })

    // Faol o'quvchilar — faqat qarz hisoblash uchun
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, course_price, payments(amount)')
      .eq('agent_id', agent.id)

    // Date va method filter
    const filtered = (logs || []).filter(p => {
      if (dateFrom && new Date(p.paid_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(p.paid_at) > new Date(dateTo + 'T23:59:59')) return false
      if (filterMethod && p.method !== filterMethod) return false
      return true
    })

    // Qarz hisoblash — faqat faol o'quvchilardan
    let debtStudents = []
    let totalExpected = 0
    students?.forEach(st => {
      const paid = st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
      const debt = Math.max(0, (st.course_price||0) - paid)
      totalExpected += st.course_price || 0
      if (debt > 0) debtStudents.push({ ...st, paid, debt })
    })

    const totalPaid = filtered.reduce((s,p) => s+Number(p.amount), 0)
    const totalCash = filtered.filter(p=>p.method==='cash').reduce((s,p) => s+Number(p.amount), 0)
    const totalCard = filtered.filter(p=>p.method==='card').reduce((s,p) => s+Number(p.amount), 0)
    const totalDebt = debtStudents.reduce((s,st) => s+st.debt, 0)

    setAgentData({ students, allPayments: filtered, totalExpected, totalPaid, totalCash, totalCard, totalDebt, debtStudents })
    setLoading(false)
  }

  const openDelete = (item) => {
    setDeleteItem(item)
    setDeletePass('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const ok = await checkDeletePassword(deletePass)
    if (!ok) return alert("Parol noto'g'ri!")
    setDeleting(true)
    // payment_id bo'lsa payments dan o'chiramiz, aks holda faqat logdan
    if (deleteItem.payment_id) {
      await supabase.from('payments').delete().eq('id', deleteItem.payment_id)
    } else {
      await supabase.from('agent_payments_log').delete().eq('id', deleteItem.id)
    }
    setShowDeleteModal(false)
    loadAgentData(selectedAgent)
    setDeleting(false)
  }

  if (!selectedAgent) {
    return (
      <div>
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

  return (
    <div>
      <button onClick={() => { setSelectedAgent(null); setAgentData(null); setDateFrom(''); setDateTo(''); setFilterMethod('') }} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit',padding:0}}>
        ← Orqaga
      </button>

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{width:48,height:48,borderRadius:12,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20,flexShrink:0}}>{selectedAgent.full_name[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18}}>{selectedAgent.full_name}</div>
            <div style={{fontSize:13,color:'#9CA3AF'}}>{selectedAgent.phone||"Telefon yo'q"}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
          <span style={{color:'#9CA3AF',fontSize:13}}>dan</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
          <span style={{color:'#9CA3AF',fontSize:13}}>gacha</span>
          <select value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
            <option value="">Barcha usullar</option>
            <option value="cash">Naqd</option>
            <option value="card">Karta</option>
          </select>
          {(dateFrom||dateTo||filterMethod) && (
            <button onClick={()=>{setDateFrom('');setDateTo('');setFilterMethod('')}} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',color:'#6B7280'}}>Tozalash ×</button>
          )}
        </div>
      </div>

      {agentData && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
          {[
            { label:"O'quvchilar", val: (agentData.students?.length||0) + ' ta' },
            { label:'Kutilgan', val: fmt(agentData.totalExpected) },
            { label:'Tushgan', val: fmt(agentData.totalPaid), color:'#059669' },
            { label:'Naqd', val: fmt(agentData.totalCash), color:'#059669' },
            { label:'Karta', val: fmt(agentData.totalCard), color:'#4338CA' },
            { label:'Umumiy qarz', val: fmt(agentData.totalDebt), color: agentData.totalDebt>0?'#DC2626':'#9CA3AF' },
          ].map((item,i) => (
            <div key={i} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{fontSize:10,color:'#9CA3AF',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
              <div style={{fontSize:16,fontWeight:800,fontFamily:'Nunito,sans-serif',color:item.color||'#1A1D2E'}}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

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
                <div style={{fontSize:11,color:'#9CA3AF'}}>To'langan: {fmt(st.paid)}</div>
              </div>
              <span style={{padding:'3px 10px',borderRadius:5,fontSize:12,fontWeight:600,background:'#FEF2F2',color:'#DC2626'}}>{fmt(st.debt)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6'}}>
          <span style={{fontWeight:700,fontSize:14}}>To'lovlar tarixi ({agentData?.allPayments?.length||0} ta)</span>
        </div>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
        ) : !agentData || agentData.allPayments.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>To'lovlar yo'q</div>
        ) : agentData.allPayments.map((p,i) => (
          <div key={i} style={{padding:'14px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
            <div style={{flex:1,minWidth:120}}>
              <div style={{fontSize:13,fontWeight:600}}>{p.student_name||'—'}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{fmtDate(p.paid_at)}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#059669'}}>{fmt(p.amount)}</span>
              <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                {p.method==='cash'?'Naqd':'Karta'}
              </span>
              {!p.payment_id && <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:600,background:'#F3F4F6',color:'#6B7280'}}>Arxiv</span>}
              {isBoss && (
                <button onClick={() => openDelete(p)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',color:'#DC2626',fontFamily:'inherit'}}>
                  O'chirish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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
