import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Groups({ isBoss }) {
  const [groups, setGroups] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name:'', teacher_id:'', course_price:'', status:'active' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: gr }, { data: tc }] = await Promise.all([
      supabase.from('groups').select('*, teachers(full_name), students(id, course_price, payments(amount))').order('created_at', { ascending: false }),
      supabase.from('teachers').select('id, full_name')
    ])
    setGroups(gr || [])
    setTeachers(tc || [])
    setLoading(false)
  }

  const openAdd = () => { setEditItem(null); setForm({ name:'', teacher_id:'', course_price:'', status:'active' }); setShowModal(true) }
  const openEdit = (g) => { setEditItem(g); setForm({ name:g.name, teacher_id:g.teacher_id||'', course_price:g.course_price||'', status:g.status }); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim()) return alert("Guruh nomini kiriting!")
    setSaving(true)
    const payload = { name:form.name, teacher_id:form.teacher_id||null, course_price:Number(form.course_price)||0, status:form.status }
    if (editItem) await supabase.from('groups').update(payload).eq('id', editItem.id)
    else await supabase.from('groups').insert([payload])
    setShowModal(false)
    loadData()
    setSaving(false)
  }

  const deleteGroup = async (id) => {
    if (!window.confirm("Guruhni o'chirasizmi?")) return
    await supabase.from('groups').delete().eq('id', id)
    loadData()
  }

  const getStats = (g) => {
    let paid = 0, expected = 0
    g.students?.forEach(st => {
      expected += st.course_price || 0
      paid += st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
    })
    return { students: g.students?.length||0, paid, expected, debt: expected - paid }
  }

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        {isBoss && (
          <button onClick={openAdd} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            + Guruh qo'shish
          </button>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
        ) : groups.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Guruhlar yo'q</div>
        ) : groups.map(g => {
          const s = getStats(g)
          return (
            <div key={g.id} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:42,height:42,borderRadius:10,background: g.status==='active'?'#DC2626':'#6B7280',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>
                  {g.name[0]}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{g.name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>{g.teachers?.full_name||"O'qituvchi yo'q"}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                  <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:g.status==='active'?'#ECFDF5':'#F3F4F6',color:g.status==='active'?'#059669':'#6B7280'}}>
                    {g.status==='active'?'Aktiv':'Tugagan'}
                  </span>
                  {isBoss && (
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={() => openEdit(g)} style={{background:'#F3F4F6',border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>
                      <button onClick={() => deleteGroup(g.id)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#DC2626'}}>×</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  { label:"O'quvchilar", val: s.students + ' ta' },
                  { label:'Tushgan', val: fmt(s.paid), color:'#059669' },
                  { label:'Kutilgan', val: fmt(s.expected) },
                  { label:'Qarz', val: fmt(s.debt), color: s.debt>0?'#DC2626':'#9CA3AF' },
                ].map((item,i) => (
                  <div key={i} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:'#9CA3AF',marginBottom:3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
                    <div style={{fontSize:14,fontWeight:700,color:item.color||'#1A1D2E'}}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>
              {editItem ? 'Guruhni tahrirlash' : "Guruh qo'shish"}
            </h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
              <div>
                <label style={labelStyle}>Guruh nomi *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="A guruh" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>O'qituvchi</label>
                <select value={form.teacher_id} onChange={e=>setForm({...form,teacher_id:e.target.value})} style={{...inputStyle,background:'#fff'}}>
                  <option value="">O'qituvchi tanlang</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Holat</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{...inputStyle,background:'#fff'}}>
                  <option value="active">Aktiv</option>
                  <option value="finished">Tugagan</option>
                </select>
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
