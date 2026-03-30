import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { checkDeletePassword } from '../lib/checkPassword'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Agents({ isBoss, onStudentClick }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentStudents, setAgentStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [form, setForm] = useState({ full_name:'', phone:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAgents() }, [])

  const loadAgents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, phone')
      .order('full_name')
    if (error) console.error('Agents error:', error)
    setAgents(data || [])
    setLoading(false)
  }

  const openAgent = async (agent) => {
    setSelectedAgent(agent)
    setLoadingStudents(true)
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, phone, course_price, groups(name), payments(amount)')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    if (error) console.error('Students error:', error)
    setAgentStudents(data || [])
    setLoadingStudents(false)
  }

  const openAdd = () => { setEditItem(null); setForm({ full_name:'', phone:'' }); setShowModal(true) }
  const openEdit = (a) => { setEditItem(a); setForm({ full_name:a.full_name, phone:a.phone||'' }); setShowModal(true) }

  const save = async () => {
    if (!form.full_name.trim()) return alert("Ism kiriting!")
    setSaving(true)
    if (editItem) {
      await supabase.from('agents').update(form).eq('id', editItem.id)
      if (selectedAgent?.id === editItem.id) setSelectedAgent({...selectedAgent, ...form})
    } else {
      await supabase.from('agents').insert([form])
    }
    setShowModal(false)
    loadAgents()
    setSaving(false)
  }

  const deleteAgent = async (id, e) => {
    e.stopPropagation()
    const pass = window.prompt("O'chirish uchun maxsus parolni kiriting:")
    if (!pass) return
    const ok = await checkDeletePassword(pass)
    if (!ok) return alert("Parol noto'g'ri!")
    await supabase.from('agents').delete().eq('id', id)
    if (selectedAgent?.id === id) setSelectedAgent(null)
    loadAgents()
  }

  const getPaid = (st) => st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
  const getDebt = (st) => Math.max(0, (st.course_price||0) - getPaid(st))

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  // Agent detail
  if (selectedAgent) {
    const totalExpected = agentStudents.reduce((s,st) => s+(st.course_price||0), 0)
    const totalPaid = agentStudents.reduce((s,st) => s+getPaid(st), 0)
    const totalDebt = agentStudents.reduce((s,st) => s+getDebt(st), 0)

    return (
      <div>
        <button onClick={() => { setSelectedAgent(null); setAgentStudents([]) }} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit',padding:0}}>
          ← Orqaga
        </button>

        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,marginBottom:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,flexWrap:'wrap'}}>
            <div style={{width:48,height:48,borderRadius:12,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20,flexShrink:0}}>
              {selectedAgent.full_name[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18}}>{selectedAgent.full_name}</div>
              <div style={{fontSize:13,color:'#9CA3AF'}}>{selectedAgent.phone||"Telefon yo'q"}</div>
            </div>
            {isBoss && (
              <button onClick={() => openEdit(selectedAgent)} style={{background:'#F3F4F6',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                ✏️ Tahrirlash
              </button>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
            {[
              { label:"O'quvchilar", val: agentStudents.length + ' ta' },
              { label:'Kutilgan', val: fmt(totalExpected) },
              { label:'Tushgan', val: fmt(totalPaid), color:'#059669' },
              { label:'Qarz', val: fmt(totalDebt), color: totalDebt>0?'#DC2626':'#9CA3AF' },
            ].map((item,i) => (
              <div key={i} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:10,color:'#9CA3AF',marginBottom:3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:item.color||'#1A1D2E'}}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6'}}>
            <span style={{fontWeight:700,fontSize:14}}>O'quvchilar</span>
          </div>
          {loadingStudents ? (
            <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
          ) : agentStudents.length === 0 ? (
            <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>O'quvchilar yo'q</div>
          ) : agentStudents.map(st => {
            const paid = getPaid(st)
            const debt = getDebt(st)
            return (
              <div key={st.id} onClick={() => onStudentClick && onStudentClick(st.id)} style={{padding:'14px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',gap:12,cursor:'pointer',flexWrap:'wrap'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                <div style={{width:32,height:32,borderRadius:8,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{st.full_name[0]}</div>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{fontSize:13,fontWeight:600}}>{st.full_name}</div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{st.groups?.name||'Guruhsiz'} · {st.phone||''}</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:600,color:'#059669'}}>{fmt(paid)}</span>
                  {debt > 0 && <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:'#FEF2F2',color:'#DC2626'}}>Qarz: {fmt(debt)}</span>}
                  {debt === 0 && st.course_price > 0 && <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:'#ECFDF5',color:'#059669'}}>To'liq</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Agents list
  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        {isBoss && (
          <button onClick={openAdd} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            + Ma'sul qo'shish
          </button>
        )}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
      ) : agents.length === 0 ? (
        <div style={{textAlign:'center',padding:60,color:'#9CA3AF',fontSize:13}}>Ma'sullar yo'q</div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
          {agents.map(a => (
            <div key={a.id} onClick={() => openAgent(a)} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)',cursor:'pointer',transition:'box-shadow .15s'}} onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'} onMouseOut={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:42,height:42,borderRadius:10,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>
                  {a.full_name[0]}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{a.full_name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>{a.phone||"Telefon yo'q"}</div>
                </div>
                {isBoss && (
                  <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button onClick={() => openEdit(a)} style={{background:'#F3F4F6',border:'none',borderRadius:6,padding:'5px 8px',fontSize:12,cursor:'pointer'}}>✏️</button>
                    <button onClick={(e) => deleteAgent(a.id, e)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'5px 8px',fontSize:12,cursor:'pointer',color:'#DC2626'}}>×</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>
              {editItem ? "Ma'sulni tahrirlash" : "Ma'sul qo'shish"}
            </h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
              <div>
                <label style={labelStyle}>Ism Familiya *</label>
                <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Rahimov Sardor" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+998901234567" style={inputStyle}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setShowModal(false)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={save} disabled={saving} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
