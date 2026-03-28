import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Students({ isBoss, onStudentClick }) {
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({ full_name:'', phone:'', group_id:'', notes:'', course_price:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: st }, { data: gr }] = await Promise.all([
      supabase.from('students').select('*, groups(name, teachers(full_name)), payments(amount)').order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name, course_price').eq('status','active')
    ])
    setStudents(st || [])
    setGroups(gr || [])
    setLoading(false)
  }

  const getPaid = (st) => st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
  const getDebt = (st) => Math.max(0, (st.course_price||0) - getPaid(st))

  const filtered = students.filter(st => {
    if (filterGroup && st.group_id !== filterGroup) return false
    if (filterStatus === 'debt' && getDebt(st) === 0) return false
    if (filterStatus === 'paid' && getDebt(st) > 0) return false
    return true
  })

  const saveStudent = async () => {
    if (!form.full_name.trim()) return alert("Ism kiriting!")
    if (!form.course_price || Number(form.course_price) <= 0) return alert("Kurs narxini kiriting!")
    setSaving(true)
    const { error } = await supabase.from('students').insert([{
      full_name: form.full_name,
      phone: form.phone,
      group_id: form.group_id || null,
      notes: form.notes,
      course_price: Number(form.course_price)
    }])
    if (error) alert('Xato: ' + error.message)
    else {
      setShowModal(false)
      setForm({ full_name:'', phone:'', group_id:'', notes:'', course_price:'' })
      loadData()
    }
    setSaving(false)
  }

  const deleteStudent = async (id) => {
    if (!window.confirm("O'quvchini o'chirasizmi?")) return
    await supabase.from('students').delete().eq('id', id)
    loadData()
  }

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha guruhlar</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha holat</option>
          <option value="debt">Qarz bor</option>
          <option value="paid">To'liq to'lagan</option>
        </select>
        <button onClick={() => setShowModal(true)} style={{marginLeft:'auto',background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          + O'quvchi qo'shish
        </button>
      </div>

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'quvchi","Guruh","O'qituvchi","Kurs narxi","To'langan","Qarz","Holat",""].map((h,i) => (
                  <th key={i} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>O'quvchilar yo'q</td></tr>
              ) : filtered.map(st => {
                const paid = getPaid(st)
                const debt = getDebt(st)
                const price = st.course_price || 0
                return (
                  <tr key={st.id} style={{borderBottom:'1px solid #F9FAFB',cursor:'pointer'}} onClick={()=>onStudentClick&&onStudentClick(st.id)} onClick={()=>onStudentClick&&onStudentClick(st.id)} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:30,height:30,borderRadius:8,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{st.full_name[0]}</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:600}}>{st.full_name}</div>
                          {st.phone && <div style={{fontSize:11,color:'#9CA3AF'}}>{st.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{st.groups?.name||'—'}</td>
                    <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{st.groups?.teachers?.full_name||'—'}</td>
                    <td style={{padding:'12px 16px',fontSize:13,fontWeight:600}}>{price>0?fmt(price):'—'}</td>
                    <td style={{padding:'12px 16px',fontSize:13,fontWeight:600,color:'#059669'}}>{fmt(paid)}</td>
                    <td style={{padding:'12px 16px',fontSize:13,fontWeight:600,color:debt>0?'#DC2626':'#9CA3AF'}}>{debt>0?fmt(debt):'—'}</td>
                    <td style={{padding:'12px 16px'}}>
                      {debt===0 && price>0
                        ? <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:'#ECFDF5',color:'#059669'}}>To'liq</span>
                        : debt>0
                        ? <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:'#FEF2F2',color:'#DC2626'}}>Qarz bor</span>
                        : <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:'#F3F4F6',color:'#6B7280'}}>Guruhsiz</span>}
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      {isBoss && <button onClick={() => deleteStudent(st.id)} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:18,padding:4}}>×</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>O'quvchi qo'shish</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>Ism Familiya *</label>
                <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Sardor Aliyev" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Telefon *</label>
                <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+998901234567" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Guruh</label>
                <select value={form.group_id} onChange={e=>setForm({...form,group_id:e.target.value})} style={{...inputStyle,background:'#fff'}}>
                  <option value="">Guruh tanlang</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>Kurs narxi (so'm) *</label>
                <input
                  type="number"
                  value={form.course_price}
                  onChange={e=>setForm({...form,course_price:e.target.value})}
                  placeholder="1200000"
                  style={inputStyle}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>Izoh</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Qo'shimcha izoh..." style={inputStyle}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setShowModal(false)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={saveStudent} disabled={saving} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
