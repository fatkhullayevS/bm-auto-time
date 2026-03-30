import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

export default function StudentDetail({ studentId, onBack, isBoss }) {
  const [student, setStudent] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [pass, setPass] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadData() }, [studentId])

  const loadData = async () => {
    setLoading(true)
    const [{ data: st }, { data: pays }] = await Promise.all([
      supabase.from('students').select('*, groups(name), agents(full_name)').eq('id', studentId).single(),
      supabase.from('payments').select('*, profiles(full_name)').eq('student_id', studentId).order('paid_at', { ascending: false })
    ])
    setStudent(st)
    setPayments(pays || [])
    setLoading(false)
  }

  const openDelete = (id) => { setDeleteId(id); setPass(''); setShowDeleteModal(true) }

  const confirmDelete = async () => {
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'delete_password').single()
    if (pass !== setting?.value) return alert("Parol noto'g'ri!")
    setDeleting(true)
    await supabase.from('payments').delete().eq('id', deleteId)
    setShowDeleteModal(false)
    loadData()
    setDeleting(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Yuklanmoqda...</div>
  if (!student) return <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>O'quvchi topilmadi</div>

  const totalPaid = payments.reduce((s,p) => s+Number(p.amount), 0)
  const debt = Math.max(0, (student.course_price||0) - totalPaid)

  return (
    <div>
      <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit',padding:0}}>
        ← Orqaga
      </button>

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,marginBottom:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{width:48,height:48,borderRadius:12,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20,flexShrink:0}}>
            {student.full_name[0]}
          </div>
          <div>
            <div style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18}}>{student.full_name}</div>
            <div style={{fontSize:13,color:'#9CA3AF',marginTop:2}}>
              {student.phone||"Telefon yo'q"} · {student.groups?.name||'Guruhsiz'} · {student.groups?.teachers?.full_name||'—'}
            </div>
            {student.notes && <div style={{fontSize:12,color:'#6B7280',marginTop:4,fontStyle:'italic'}}>"{student.notes}"</div>}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
          {[
            { label:'Kurs narxi', val: fmt(student.course_price||0) },
            { label:"To'langan", val: fmt(totalPaid), color:'#059669' },
            { label:'Qarz', val: fmt(debt), color: debt>0?'#DC2626':'#9CA3AF' },
            { label:"To'lovlar soni", val: payments.length + ' ta' },
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
          <span style={{fontWeight:700,fontSize:14}}>Tranzaksiyalar</span>
        </div>
        {payments.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Hozircha to'lovlar yo'q</div>
        ) : (
          <div>
            {payments.map((p,i) => (
              <div key={i} style={{padding:'14px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#059669'}}>{fmt(p.amount)}</div>
                  <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{fmtDate(p.paid_at)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                    {p.method==='cash'?'Naqd':'Karta'}
                  </span>
                  <span style={{fontSize:12,color:'#9CA3AF'}}>{p.profiles?.full_name||'—'}</span>
                  {isBoss && (
                    <button onClick={() => openDelete(p.id)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:'pointer',color:'#DC2626',fontFamily:'inherit'}}>
                      O'chirish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:8}}>Tranzaksiyani o'chirish</h2>
            <p style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Bu amalni qaytarib bo'lmaydi. Davom etish uchun maxsus parolni kiriting.</p>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Maxsus parol</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmDelete()} placeholder="Parol kiriting..." style={{width:'100%',padding:'9px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setShowDeleteModal(false)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={confirmDelete} disabled={deleting} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
