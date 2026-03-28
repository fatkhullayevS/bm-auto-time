import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { checkDeletePassword } from '../lib/checkPassword'

export default function Teachers({ isBoss }) {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ full_name:'', phone:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('teachers')
      .select('*, groups(id, name, course_price, status, students(id, payments(amount)))')
      .order('created_at', { ascending: false })
    setTeachers(data || [])
    setLoading(false)
  }

  const openAdd = () => { setEditItem(null); setForm({ full_name:'', phone:'' }); setShowModal(true) }
  const openEdit = (t) => { setEditItem(t); setForm({ full_name:t.full_name, phone:t.phone||'' }); setShowModal(true) }

  const save = async () => {
    if (!form.full_name.trim()) return alert("Ism kiriting!")
    setSaving(true)
    if (editItem) await supabase.from('teachers').update(form).eq('id', editItem.id)
    else await supabase.from('teachers').insert([form])
    setShowModal(false)
    loadData()
    setSaving(false)
  }

  const deleteTeacher = async (id) => {
    const pass = window.prompt("O'chirish uchun maxsus parolni kiriting:")
    if (!pass) return
    const ok = await checkDeletePassword(pass)
    if (!ok) return alert("Parol noto'g'ri!")
    await supabase.from('teachers').delete().eq('id', id)
    loadData()
  }

  const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

  const getStats = (teacher) => {
    let expected = 0, paid = 0, students = 0
    teacher.groups?.forEach(g => {
      const price = g.course_price || 0
      g.students?.forEach(st => {
        students++
        expected += price
        paid += st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
      })
    })
    return { expected, paid, debt: expected - paid, students, groups: teacher.groups?.length || 0 }
  }

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        {isBoss && (
          <button onClick={openAdd} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            + O'qituvchi qo'shish
          </button>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
        ) : teachers.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>O'qituvchilar yo'q</div>
        ) : teachers.map(t => {
          const s = getStats(t)
          return (
            <div key={t.id} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:42,height:42,borderRadius:10,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>
                  {t.full_name[0]}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{t.full_name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>{t.phone||"Telefon yo'q"}</div>
                </div>
                {isBoss && (
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={() => openEdit(t)} style={{background:'#F3F4F6',border:'none',borderRadius:6,padding:'6px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#374151'}}>✏️</button>
                    <button onClick={() => deleteTeacher(t.id)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'6px 10px',fontSize:12,cursor:'pointer',color:'#DC2626'}}>×</button>
                  </div>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  { label:'Guruhlar', val: s.groups + ' ta' },
                  { label:"O'quvchilar", val: s.students + ' ta' },
                  { label:'Kutilgan', val: fmt(s.expected), color:'#1A1D2E' },
                  { label:'Tushgan', val: fmt(s.paid), color:'#059669' },
                  { label:'Qarz', val: fmt(s.debt), color: s.debt>0?'#DC2626':'#9CA3AF', span: true },
                ].map((item,i) => (
                  <div key={i} style={{gridColumn:item.span?'1/-1':'auto',background:'#F9FAFB',borderRadius:8,padding:'10px 12px'}}>
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
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>
              {editItem ? "O'qituvchini tahrirlash" : "O'qituvchi qo'shish"}
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
