import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Payments({ isBoss, session, openModal, setOpenModal }) {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [form, setForm] = useState({ amount:'', method:'cash', notes:'' })
  const [saving, setSaving] = useState(false)
  const [filterMethod, setFilterMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { loadPayments() }, [])
  useEffect(() => { if (openModal) { setShowModal(true); setOpenModal && setOpenModal(false) } }, [openModal])

  const loadPayments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, students(id, full_name, phone, groups(name)), profiles(full_name)')
      .order('paid_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  const searchStudents = async (q) => {
    setSearch(q)
    if (!q.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('students')
      .select('*, groups(name, course_price), payments(amount)')
      .ilike('full_name', `%${q}%`)
      .limit(8)
    const debtOnly = data?.filter(st => {
      const paid = st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
      const debt = (st.course_price||0) - paid
      return debt > 0
    })
    setSearchResults(debtOnly || [])
  }

  const selectStudent = (st) => {
    setSelectedStudent(st)
    setSearch(st.full_name)
    setSearchResults([])
  }

  const getPaid = (st) => st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
  const getDebt = (st) => Math.max(0, (st.course_price||0) - getPaid(st))

  const savePayment = async () => {
    if (!selectedStudent) return alert("O'quvchi tanlang!")
    if (!form.amount || Number(form.amount) <= 0) return alert("Summa kiriting!")
    setSaving(true)
    const { error } = await supabase.from('payments').insert([{
      student_id: selectedStudent.id,
      amount: Number(form.amount),
      method: form.method,
      notes: form.notes,
      cashier_id: session.user.id,
      paid_at: new Date().toISOString()
    }])
    if (error) alert('Xato: ' + error.message)
    else {
      // Google Sheets ga yuborish
      const studentData = selectedStudent
      const paymentData = {
        record: {
          paid_at: new Date().toISOString(),
          amount: Number(form.amount),
          method: form.method,
          student_name: studentData.full_name || '',
          group_name: studentData.groups?.name || '',
          teacher_name: studentData.groups?.teachers?.full_name || '',
          cashier_name: session.user.email || ''
        }
      }
      fetch('https://script.google.com/macros/s/AKfycbyPOIprd0RF-2QmViReI_uJp4xswTF1TSKHylzFxBoCRbgiUnDbZzX74FM3RrO0BbVvdA/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      }).catch(() => {})
      setShowModal(false)
      setSelectedStudent(null)
      setSearch('')
      setForm({ amount:'', method:'cash', notes:'' })
      loadPayments()
    }
    setSaving(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedStudent(null)
    setSearch('')
    setSearchResults([])
    setForm({ amount:'', method:'cash', notes:'' })
  }

  const filtered = payments.filter(p => {
    if (filterMethod && p.method !== filterMethod) return false
    if (dateFrom && new Date(p.paid_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(p.paid_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalFiltered = filtered.reduce((s,p) => s+Number(p.amount), 0)

  const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  return (
    <div>
      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha usullar</option>
          <option value="cash">Naqd</option>
          <option value="card">Karta</option>
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        {(filterMethod||dateFrom||dateTo) && (
          <button onClick={()=>{setFilterMethod('');setDateFrom('');setDateTo('')}} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',color:'#6B7280'}}>
            Tozalash ×
          </button>
        )}
        <button onClick={() => setShowModal(true)} style={{marginLeft:'auto',background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          + To'lov kiritish
        </button>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div style={{background:'#fff',borderRadius:10,border:'1px solid #E5E7EB',padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:13,color:'#6B7280'}}>{filtered.length} ta to'lov</span>
          <span style={{fontSize:14,fontWeight:700,color:'#059669'}}>{fmt(totalFiltered)}</span>
        </div>
      )}

      {/* Table */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'quvchi","Guruh","Kassir","Summa","Usul","Sana"].map((h,i) => (
                  <th key={i} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>To'lovlar yo'q</td></tr>
              ) : filtered.map((p,i) => (
                <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:7,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700,flexShrink:0}}>
                        {p.students?.full_name?.[0]||'?'}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{p.students?.full_name||'—'}</div>
                        {p.students?.phone && <div style={{fontSize:11,color:'#9CA3AF'}}>{p.students.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.groups?.name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#9CA3AF'}}>{p.profiles?.full_name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:700,color:'#1A1D2E'}}>{fmt(p.amount)}</td>
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

      {/* Modal */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>To'lov kiritish</h2>

            {/* Student search */}
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>O'quvchi (faqat qarzdorlar) *</label>
              <div style={{position:'relative'}}>
                <input
                  value={search}
                  onChange={e=>searchStudents(e.target.value)}
                  placeholder="Ism bo'yicha qidiring..."
                  style={inputStyle}
                  autoComplete="off"
                />
                {searchResults.length > 0 && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,.1)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                    {searchResults.map(st => (
                      <div key={st.id} onClick={() => selectStudent(st)} style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #F3F4F6',fontSize:13}} onMouseOver={e=>e.currentTarget.style.background='#F9FAFB'} onMouseOut={e=>e.currentTarget.style.background=''}>
                        <div style={{fontWeight:600}}>{st.full_name}</div>
                        <div style={{fontSize:11,color:'#9CA3AF'}}>{st.groups?.name||'Guruhsiz'} · Qarz: {fmt(getDebt(st))}</div>
                      </div>
                    ))}
                  </div>
                )}
                {search.length > 1 && searchResults.length === 0 && !selectedStudent && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'12px 14px',fontSize:13,color:'#9CA3AF',marginTop:4,zIndex:10}}>
                    Qarzdor o'quvchi topilmadi
                  </div>
                )}
              </div>
            </div>

            {/* Selected student info */}
            {selectedStudent && (
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13}}>
                <div style={{fontWeight:600,color:'#991B1B',marginBottom:3}}>{selectedStudent.full_name}</div>
                <div style={{color:'#DC2626',fontSize:12}}>
                  Kurs narxi: {fmt(selectedStudent.course_price||0)} · 
                  To'langan: {fmt(getPaid(selectedStudent))} · 
                  Qarz: {fmt(getDebt(selectedStudent))}
                </div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>Summa (so'm) *</label>
                <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="500000" style={inputStyle}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>To'lov usuli</label>
                <div style={{display:'flex',gap:8}}>
                  {[{val:'cash',label:'Naqd pul'},{val:'card',label:'Karta'}].map(m => (
                    <div key={m.val} onClick={() => setForm({...form,method:m.val})} style={{flex:1,padding:'9px',border:`1.5px solid ${form.method===m.val?'#DC2626':'#E5E7EB'}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',background:form.method===m.val?'#FEF2F2':'#fff',color:form.method===m.val?'#DC2626':'#6B7280',transition:'all .15s'}}>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={labelStyle}>Izoh</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ixtiyoriy izoh..." style={inputStyle}/>
              </div>
            </div>

            {selectedStudent && form.amount && (
              <div style={{background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#065F46'}}>
                To'lovdan keyin qoladi: <strong>{fmt(Math.max(0, getDebt(selectedStudent) - Number(form.amount)))}</strong>
              </div>
            )}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={closeModal} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={savePayment} disabled={saving} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
