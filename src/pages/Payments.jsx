import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { checkDeletePassword } from '../lib/checkPassword'
import { formatMoneyInput, parseMoneyInput } from '../lib/moneyMask'
import { notifyTelegram } from '../lib/notifyTelegram'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Payments({ isBoss, session, openModal, setOpenModal }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)
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
      .select('*, groups(name, course_price), agents(full_name), payments(amount)')
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
    const amountNum = parseMoneyInput(form.amount)
    if (!amountNum || amountNum <= 0) return alert("Summa kiriting!")
    const pass = window.prompt("To'lov kiritish uchun parolni kiriting:")
    if (!pass) return
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'view_password').single()
    if (pass !== setting?.value) return alert("Parol noto'g'ri!")
    setSaving(true)
    const { error } = await supabase.from('payments').insert([{
      student_id: selectedStudent.id,
      amount: amountNum,
      method: form.method,
      notes: form.notes,
      cashier_id: session.user.id,
      paid_at: new Date().toISOString()
    }])
    if (error) alert('Xato: ' + error.message)
    else {
      const studentData = selectedStudent
      const remaining = Math.max(0, getDebt(studentData) - amountNum)
      notifyTelegram('payment', {
        student_name: studentData.full_name || '',
        group_name: studentData.groups?.name || '',
        agent_name: studentData.agents?.full_name || '',
        paid_amount: amountNum,
        remaining_debt: remaining,
      })
      fetch('https://script.google.com/macros/s/AKfycbyPOIprd0RF-2QmViReI_uJp4xswTF1TSKHylzFxBoCRbgiUnDbZzX74FM3RrO0BbVvdA/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            paid_at: new Date().toISOString(),
            amount: amountNum,
            method: form.method,
            student_name: studentData.full_name || '',
            group_name: studentData.groups?.name || '',
            teacher_name: '',
            cashier_name: session.user.email || ''
          }
        })
      }).catch(() => {})
      closeModal()
      loadPayments()
    }
    setSaving(false)
  }

  const openDeleteModal = (id) => { setDeleteId(id); setDeletePass(''); setShowDeleteModal(true) }

  const confirmDelete = async () => {
    const ok = await checkDeletePassword(deletePass)
    if (!ok) return alert("Parol noto'g'ri!")
    setDeleting(true)
    await supabase.from('payments').delete().eq('id', deleteId)
    setShowDeleteModal(false)
    loadPayments()
    setDeleting(false)
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
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option value="">Barcha usullar</option>
          <option value="cash">Naqd</option>
          <option value="card">Karta</option>
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
        {(filterMethod||dateFrom||dateTo) && (
          <button onClick={()=>{setFilterMethod('');setDateFrom('');setDateTo('')}} style={{padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12,background:'#fff',cursor:'pointer',fontFamily:'inherit',color:'#6B7280'}}>Tozalash ×</button>
        )}
        <button onClick={() => setShowModal(true)} style={{marginLeft:'auto',background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          + To'lov kiritish
        </button>
      </div>

      {filtered.length > 0 && (
        <div style={{background:'#fff',borderRadius:10,border:'1px solid #E5E7EB',padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:13,color:'#6B7280'}}>{filtered.length} ta to'lov</span>
          <span style={{fontSize:14,fontWeight:700,color:'#059669'}}>{fmt(totalFiltered)}</span>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>To'lovlar yo'q</div>
        ) : filtered.map((p,i) => (
          <div key={i} style={{padding:'14px 18px',borderBottom:'1px solid #F9FAFB',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
            <div style={{width:32,height:32,borderRadius:8,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>
              {p.students?.full_name?.[0]||'?'}
            </div>
            <div style={{flex:1,minWidth:120}}>
              <div style={{fontSize:13,fontWeight:600}}>{p.students?.full_name||'—'}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{p.students?.groups?.name||'—'} · {p.profiles?.full_name||'—'}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#1A1D2E'}}>{fmt(p.amount)}</span>
              <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                {p.method==='cash'?'Naqd':'Karta'}
              </span>
              <span style={{fontSize:12,color:'#9CA3AF',whiteSpace:'nowrap'}}>{fmtDate(p.paid_at)}</span>
              {isBoss && (
                <button onClick={() => openDeleteModal(p.id)} style={{background:'#FEF2F2',border:'none',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:'pointer',color:'#DC2626',fontFamily:'inherit'}}>
                  O'chirish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.15)',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>To'lov kiritish</h2>
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>O'quvchi (faqat qarzdorlar) *</label>
              <div style={{position:'relative'}}>
                <input value={search} onChange={e=>searchStudents(e.target.value)} placeholder="Ism bo'yicha qidiring..." style={inputStyle} autoComplete="off"/>
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
            {selectedStudent && (
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13}}>
                <div style={{fontWeight:600,color:'#991B1B',marginBottom:3}}>{selectedStudent.full_name}</div>
                <div style={{color:'#DC2626',fontSize:12}}>
                  Kurs narxi: {fmt(selectedStudent.course_price||0)} · To'langan: {fmt(getPaid(selectedStudent))} · Qarz: {fmt(getDebt(selectedStudent))}
                </div>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:14}}>
              <div>
                <label style={labelStyle}>Summa (so'm) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: formatMoneyInput(e.target.value) })}
                  placeholder="3.000.000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>To'lov usuli</label>
                <div style={{display:'flex',gap:8}}>
                  {[{val:'cash',label:'Naqd pul'},{val:'card',label:'Karta'}].map(m => (
                    <div key={m.val} onClick={() => setForm({...form,method:m.val})} style={{flex:1,padding:'9px',border:`1.5px solid ${form.method===m.val?'#DC2626':'#E5E7EB'}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',background:form.method===m.val?'#FEF2F2':'#fff',color:form.method===m.val?'#DC2626':'#6B7280',transition:'all .15s'}}>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Izoh</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ixtiyoriy izoh..." style={inputStyle}/>
              </div>
            </div>
            {selectedStudent && form.amount && parseMoneyInput(form.amount) > 0 && (
              <div style={{background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#065F46'}}>
                To'lovdan keyin qoladi: <strong>{fmt(Math.max(0, getDebt(selectedStudent) - parseMoneyInput(form.amount)))}</strong>
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

      {showDeleteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:8}}>Tranzaksiyani o'chirish</h2>
            <p style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Bu amalni qaytarib bo'lmaydi. Maxsus parolni kiriting.</p>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Maxsus parol</label>
              <input type="password" value={deletePass} onChange={e=>setDeletePass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmDelete()} placeholder="Parol kiriting..." style={{width:'100%',padding:'9px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
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
