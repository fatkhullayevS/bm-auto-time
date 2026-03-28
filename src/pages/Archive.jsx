import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Archive() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmGroup, setConfirmGroup] = useState(null)
  const [step, setStep] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState('')

  useEffect(() => { loadGroups() }, [])

  const loadGroups = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('groups')
      .select('*, teachers(full_name), students(id, full_name, phone, course_price, notes, enrolled_at, payments(amount, method, paid_at))')
      .order('created_at', { ascending: false })
    setGroups(data || [])
    setLoading(false)
  }

  const getStats = (g) => {
    let paid = 0, expected = 0
    g.students?.forEach(st => {
      expected += st.course_price || 0
      paid += st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
    })
    return { students: g.students?.length||0, paid, expected }
  }

  const exportCSV = (g) => {
    const rows = [
      ["Guruh","O'qituvchi","O'quvchi","Telefon","Kurs narxi","To'langan","Qarz","Izoh","Qabul sanasi"],
      ...(g.students?.map(st => {
        const paid = st.payments?.reduce((s,p)=>s+Number(p.amount),0)||0
        const debt = Math.max(0,(st.course_price||0)-paid)
        return [g.name, g.teachers?.full_name||'', st.full_name, st.phone||'', st.course_price||0, paid, debt, st.notes||'', st.enrolled_at||'']
      }) || [])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `arxiv_${g.name}_${new Date().toLocaleDateString('uz-UZ')}.csv`
    a.click()
  }

  const startArchive = (g) => {
    setConfirmGroup(g)
    setStep(1)
    setPass('')
    setPassError('')
  }

  const checkPassword = async (inputPass) => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'delete_password').single()
    return data?.value === inputPass
  }

  const doExportAndDelete = async () => {
    if (step === 1) {
      const ok = await checkPassword(pass)
      if (!ok) { setPassError("Parol noto'g'ri!"); return }
      setPassError('')
      setExporting(true)
      exportCSV(confirmGroup)
      setTimeout(() => { setExporting(false); setStep(2) }, 800)
      return
    }
    if (step === 2) {
      setDeleting(true)
      const studentIds = confirmGroup.students?.map(s=>s.id) || []
      if (studentIds.length > 0) {
        await supabase.from('payments').delete().in('student_id', studentIds)
        await supabase.from('students').delete().in('id', studentIds)
      }
      await supabase.from('groups').delete().eq('id', confirmGroup.id)
      setConfirmGroup(null)
      setDeleting(false)
      loadGroups()
    }
  }

  return (
    <div>
      <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#92400E'}}>
        <strong>Diqqat:</strong> Arxivlashdan oldin CSV fayl yuklab olinadi. Keyin guruh va barcha o'quvchilar bazadan o'chiriladi. Bu amalni qaytarib bo'lmaydi.
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>Yuklanmoqda...</div>
      ) : groups.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'#9CA3AF',fontSize:13}}>Guruhlar yo'q</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {groups.map(g => {
            const s = getStats(g)
            return (
              <div key={g.id} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,display:'flex',alignItems:'center',gap:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)',flexWrap:'wrap'}}>
                <div style={{width:42,height:42,borderRadius:10,background:g.status==='active'?'#DC2626':'#6B7280',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>
                  {g.name[0]}
                </div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{g.name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>
                    {g.teachers?.full_name||"O'qituvchi yo'q"} · {s.students} o'quvchi
                  </div>
                </div>
                <div style={{display:'flex',gap:16,fontSize:13}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{color:'#9CA3AF',fontSize:11,marginBottom:2}}>TUSHGAN</div>
                    <div style={{fontWeight:700,color:'#059669'}}>{fmt(s.paid)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{color:'#9CA3AF',fontSize:11,marginBottom:2}}>KUTILGAN</div>
                    <div style={{fontWeight:700}}>{fmt(s.expected)}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => exportCSV(g)} style={{padding:'8px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'#fff',fontFamily:'inherit',color:'#374151'}}>
                    CSV yuklab olish
                  </button>
                  <button onClick={() => startArchive(g)} style={{padding:'8px 14px',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'#FEF2F2',color:'#DC2626',fontFamily:'inherit'}}>
                    Arxivlash va o'chirish
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmGroup && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:12}}>
              {step===1 ? 'Arxivlash tasdiqlash' : 'Arxivlash — 2-qadam'}
            </h2>
            <div style={{background:'#F9FAFB',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13}}>
              <div style={{fontWeight:600,marginBottom:4}}>{confirmGroup.name}</div>
              <div style={{color:'#6B7280'}}>{getStats(confirmGroup).students} o'quvchi · {confirmGroup.teachers?.full_name||'—'}</div>
            </div>

            {step===1 ? (
              <>
                <p style={{fontSize:13,color:'#6B7280',marginBottom:14}}>
                  Arxivlash uchun maxsus parolni kiriting. CSV fayl yuklab olinadi, keyin o'chirish tasdiqlash so'raladi.
                </p>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Maxsus parol</label>
                  <input
                    type="password"
                    value={pass}
                    onChange={e=>{setPass(e.target.value);setPassError('')}}
                    onKeyDown={e=>e.key==='Enter'&&doExportAndDelete()}
                    placeholder="Parol kiriting..."
                    style={{width:'100%',padding:'9px 12px',border:`1px solid ${passError?'#EF4444':'#E5E7EB'}`,borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                  />
                  {passError && <div style={{fontSize:12,color:'#EF4444',marginTop:4}}>{passError}</div>}
                </div>
              </>
            ) : (
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'12px 14px',marginBottom:20,fontSize:13,color:'#991B1B'}}>
                CSV yuklab olindi. Endi guruh va barcha o'quvchilar <strong>bazadan o'chiriladi</strong>. Davom etasizmi?
              </div>
            )}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setConfirmGroup(null)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={doExportAndDelete} disabled={exporting||deleting} style={{padding:'9px 18px',borderRadius:8,border:'none',background:step===1?'#1A1D2E':'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {exporting ? 'CSV yuklanmoqda...' : deleting ? "O'chirilmoqda..." : step===1 ? 'Tasdiqlash' : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
