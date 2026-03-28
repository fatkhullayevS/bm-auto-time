import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
const hide = (val, locked) => locked ? '••••••' : val

export default function Reports({ isBoss }) {
  const [payments, setPayments] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [locked, setLocked] = useState(true)
  const [pass, setPass] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: pays }, { data: tc }] = await Promise.all([
      supabase.from('payments').select('*, students(full_name, course_price, groups(name, teacher_id, teachers(full_name)))').order('paid_at', { ascending: false }),
      supabase.from('teachers').select('id, full_name')
    ])
    setPayments(pays || [])
    setTeachers(tc || [])
    setLoading(false)
  }

  const unlock = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key','view_password').single()
    if (data?.value === pass) { setLocked(false); setPass('') }
    else alert("Parol noto'g'ri!")
  }

  const filtered = payments.filter(p => {
    if (filterMethod && p.method !== filterMethod) return false
    if (filterTeacher && p.students?.groups?.teacher_id !== filterTeacher) return false
    if (dateFrom && new Date(p.paid_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(p.paid_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalCash = filtered.filter(p=>p.method==='cash').reduce((s,p)=>s+Number(p.amount),0)
  const totalCard = filtered.filter(p=>p.method==='card').reduce((s,p)=>s+Number(p.amount),0)
  const total = totalCash + totalCard

  const teacherStats = teachers.map(t => {
    const tPays = filtered.filter(p => p.students?.groups?.teacher_id === t.id)
    return { ...t, total: tPays.reduce((s,p)=>s+Number(p.amount),0), count: tPays.length }
  }).filter(t => t.count > 0)

  const exportCSV = () => {
    if (locked) return alert("Avval parol bilan oching!")
    const rows = [
      ["O'quvchi","Guruh","O'qituvchi","Summa","Usul","Sana"],
      ...filtered.map(p => [
        p.students?.full_name||'',
        p.students?.groups?.name||'',
        p.students?.groups?.teachers?.full_name||'',
        p.amount,
        p.method==='cash'?'Naqd':'Karta',
        new Date(p.paid_at).toLocaleDateString('uz-UZ')
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hisobot_${new Date().toLocaleDateString('uz-UZ')}.csv`
    a.click()
  }

  const inputStyle = { padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', background:'#fff' }

  return (
    <div>
      {/* Lock banner */}
      {locked && (
        <div style={{background:'#1A1D2E',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{color:'#fff',fontWeight:600,fontSize:14,marginBottom:2}}>Hisobot ma'lumotlari shifrlangan</div>
            <div style={{color:'#6B7280',fontSize:12}}>Summalarni ko'rish uchun maxsus parol kiriting</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <input
              type="password"
              value={pass}
              onChange={e=>setPass(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&unlock()}
              placeholder="Parol..."
              style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',width:160}}
            />
            <button onClick={unlock} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Ochish</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:16,marginBottom:20,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputStyle}/>
        <span style={{color:'#9CA3AF',fontSize:13}}>dan</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputStyle}/>
        <span style={{color:'#9CA3AF',fontSize:13}}>gacha</span>
        <select value={filterTeacher} onChange={e=>setFilterTeacher(e.target.value)} style={inputStyle}>
          <option value="">Barcha o'qituvchilar</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <select value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={inputStyle}>
          <option value="">Barcha usullar</option>
          <option value="cash">Naqd</option>
          <option value="card">Karta</option>
        </select>
        {(dateFrom||dateTo||filterTeacher||filterMethod) && (
          <button onClick={()=>{setDateFrom('');setDateTo('');setFilterTeacher('');setFilterMethod('')}} style={{...inputStyle,cursor:'pointer',color:'#6B7280'}}>Tozalash ×</button>
        )}
        <button onClick={exportCSV} style={{marginLeft:'auto',background:'#1A1D2E',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          CSV yuklab olish
        </button>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:20}}>
        {[
          { label:"Jami tushum", val: hide(fmt(total), locked), color: locked?'#9CA3AF':'#1A1D2E' },
          { label:"Naqd", val: hide(fmt(totalCash), locked), color: locked?'#9CA3AF':'#059669' },
          { label:"Karta", val: hide(fmt(totalCard), locked), color: locked?'#9CA3AF':'#4338CA' },
          { label:"To'lovlar soni", val: filtered.length + ' ta', color:'#1A1D2E' },
        ].map((item,i) => (
          <div key={i} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#9CA3AF',marginBottom:8,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{item.label}</div>
            <div style={{fontSize:22,fontWeight:800,fontFamily:'Nunito,sans-serif',color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Teacher stats */}
      {teacherStats.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)',marginBottom:20}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6'}}>
            <span style={{fontWeight:700,fontSize:14}}>O'qituvchilar bo'yicha</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'qituvchi","To'lovlar soni","Jami summa"].map((h,i) => (
                  <th key={i} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teacherStats.map((t,i) => (
                <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:30,height:30,borderRadius:8,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700}}>{t.full_name[0]}</div>
                      <span style={{fontSize:13,fontWeight:600}}>{t.full_name}</span>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{t.count} ta</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:700,color:locked?'#9CA3AF':'#059669'}}>{hide(fmt(t.total), locked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments table */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6'}}>
          <span style={{fontWeight:700,fontSize:14}}>To'lovlar ({filtered.length} ta)</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAFA'}}>
                {["O'quvchi","Guruh","O'qituvchi","Summa","Usul","Sana"].map((h,i) => (
                  <th key={i} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Ma'lumot yo'q</td></tr>
              ) : filtered.map((p,i) => (
                <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}} onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:600}}>{p.students?.full_name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.groups?.name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#6B7280'}}>{p.students?.groups?.teachers?.full_name||'—'}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:700,color:locked?'#9CA3AF':'#059669'}}>{hide(fmt(p.amount), locked)}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{padding:'3px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:p.method==='cash'?'#ECFDF5':'#EEF2FF',color:p.method==='cash'?'#059669':'#4338CA'}}>
                      {p.method==='cash'?'Naqd':'Karta'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#9CA3AF',whiteSpace:'nowrap'}}>{new Date(p.paid_at).toLocaleDateString('uz-UZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
