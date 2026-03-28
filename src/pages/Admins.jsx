import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Admins() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email:'', password:'', full_name:'', role:'cashier' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const createUser = async () => {
    if (!form.email || !form.password || !form.full_name) return alert("Barcha maydonlarni to'ldiring!")
    if (form.password.length < 6) return alert("Parol kamida 6 ta belgidan iborat bo'lsin!")
    setSaving(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const res = await fetch(`https://ygqffofmaapjdziqwkzj.supabase.co/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: { full_name: form.full_name, role: form.role }
        })
      })
      const data = await res.json()
      if (data.error || data.msg) {
        alert('Xato: ' + (data.error || data.msg))
      } else {
        await supabase.from('profiles').upsert({
          id: data.id,
          full_name: form.full_name,
          role: form.role
        })
        setShowModal(false)
        setForm({ email:'', password:'', full_name:'', role:'cashier' })
        setMsg("Foydalanuvchi muvaffaqiyatli qo'shildi!")
        setTimeout(() => setMsg(''), 3000)
        loadData()
      }
    } catch(e) {
      alert('Xato: ' + e.message)
    }
    setSaving(false)
  }

  const roleLabel = (role) => {
    if (role === 'boss') return 'Boss'
    if (role === 'cashier') return 'Kassir'
    if (role === 'viewer') return 'Kuzatuvchi'
    return role
  }

  const roleColor = (role) => {
    if (role === 'boss') return { bg:'#FEF2F2', color:'#DC2626' }
    if (role === 'cashier') return { bg:'#EEF2FF', color:'#4338CA' }
    return { bg:'#F3F4F6', color:'#6B7280' }
  }

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', fontSize:12, fontWeight:600, color:'#6B7280', marginBottom:5 }

  return (
    <div>
      {msg && (
        <div style={{background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'#065F46',fontWeight:600}}>
          {msg}
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:700,fontSize:14}}>Foydalanuvchilar</span>
          <button onClick={() => setShowModal(true)} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            + Qo'shish
          </button>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9CA3AF',fontSize:13}}>Yuklanmoqda...</div>
        ) : users.map(u => {
          const rc = roleColor(u.role)
          return (
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',borderBottom:'1px solid #F9FAFB'}}>
              <div style={{width:38,height:38,borderRadius:10,background:'#DC2626',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:700,flexShrink:0}}>
                {u.full_name?.[0]||'?'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{u.full_name}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>
                  {u.role === 'boss' ? 'Barcha huquqlar' : u.role === 'cashier' ? "To'lov kiritish, o'quvchi qo'shish" : 'Faqat ko\'rish'}
                </div>
              </div>
              <span style={{padding:'3px 10px',borderRadius:5,fontSize:11,fontWeight:600,background:rc.bg,color:rc.color}}>
                {roleLabel(u.role)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        {[
          { role:'Kassir', color:'#4338CA', bg:'#EEF2FF', desc:"To'lov kiritish, o'quvchi qo'shish. Hech narsani o'chira olmaydi." },
          { role:'Kuzatuvchi', color:'#6B7280', bg:'#F3F4F6', desc:"Faqat ma'lumotlarni ko'rish. Hech narsa qo'sha yoki o'chira olmaydi." },
        ].map((item,i) => (
          <div key={i} style={{background:'#fff',borderRadius:10,border:'1px solid #E5E7EB',padding:'14px 16px'}}>
            <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:item.bg,color:item.color,marginBottom:8,display:'inline-block'}}>{item.role}</span>
            <div style={{fontSize:12,color:'#6B7280'}}>{item.desc}</div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:18,marginBottom:20}}>Yangi foydalanuvchi</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
              <div>
                <label style={labelStyle}>Ism Familiya *</label>
                <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Dilnoza Karimova" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="kassir@gmail.com" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Parol *</label>
                <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Kamida 6 ta belgi" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Rol</label>
                <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{...inputStyle,background:'#fff'}}>
                  <option value="cashier">Kassir — to'lov kiritish, o'quvchi qo'shish</option>
                  <option value="viewer">Kuzatuvchi — faqat ko'rish</option>
                </select>
              </div>
            </div>
            <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92400E',marginBottom:16}}>
              Boss akkaunt faqat koddan qo'shiladi. Bu sahifadan faqat kassir va kuzatuvchi qo'shish mumkin.
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setShowModal(false)} style={{padding:'9px 18px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Bekor</button>
              <button onClick={createUser} disabled={saving} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
