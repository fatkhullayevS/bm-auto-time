import { useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Search({ onStudentClick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = async (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*, groups(name, teachers(full_name)), payments(amount)')
      .ilike('full_name', `%${q}%`)
      .limit(20)
    setResults(data || [])
    setSearched(true)
    setLoading(false)
  }

  const getPaid = (st) => st.payments?.reduce((s,p) => s+Number(p.amount), 0) || 0
  const getDebt = (st) => Math.max(0, (st.course_price||0) - getPaid(st))

  return (
    <div>
      <div style={{marginBottom:20}}>
        <input
          type="text"
          value={query}
          onChange={e => doSearch(e.target.value)}
          placeholder="O'quvchi ismi bo'yicha qidiring..."
          autoFocus
          style={{width:'100%',padding:'12px 16px',border:'1.5px solid #E5E7EB',borderRadius:10,fontSize:15,fontFamily:'inherit',outline:'none',boxSizing:'border-box',transition:'border .15s'}}
          onFocus={e=>e.target.style.borderColor='#DC2626'}
          onBlur={e=>e.target.style.borderColor='#E5E7EB'}
        />
      </div>

      {loading && <div style={{textAlign:'center',padding:40,color:'#9CA3AF',fontSize:13}}>Qidirilmoqda...</div>}

      {!loading && searched && results.length === 0 && (
        <div style={{textAlign:'center',padding:40,color:'#9CA3AF',fontSize:13}}>"{query}" bo'yicha natija topilmadi</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          {results.map((st, i) => {
            const paid = getPaid(st)
            const debt = getDebt(st)
            return (
              <div
                key={st.id}
                onClick={() => onStudentClick && onStudentClick(st.id)}
                style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderBottom: i<results.length-1?'1px solid #F3F4F6':'none',cursor:'pointer',transition:'background .1s'}}
                onMouseOver={e=>e.currentTarget.style.background='#FAFBFF'}
                onMouseOut={e=>e.currentTarget.style.background=''}
              >
                <div style={{width:40,height:40,borderRadius:10,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>
                  {st.full_name[0]}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{st.full_name}</div>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>
                    {st.groups?.name||'Guruhsiz'} · {st.groups?.teachers?.full_name||'—'}
                    {st.phone && ` · ${st.phone}`}
                  </div>
                  {st.notes && <div style={{fontSize:11,color:'#9CA3AF',marginTop:2,fontStyle:'italic'}}>"{st.notes}"</div>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#059669',marginBottom:2}}>{fmt(paid)}</div>
                  {debt > 0
                    ? <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:'#FEF2F2',color:'#DC2626'}}>Qarz: {fmt(debt)}</span>
                    : <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:'#ECFDF5',color:'#059669'}}>To'liq</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!searched && (
        <div style={{textAlign:'center',padding:60,color:'#D1D5DB'}}>
          <div style={{fontSize:48,marginBottom:12}}>🔍</div>
          <div style={{fontSize:14,color:'#9CA3AF'}}>O'quvchi ismini yozing</div>
        </div>
      )}
    </div>
  )
}
