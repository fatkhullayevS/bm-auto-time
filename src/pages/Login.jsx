import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email yoki parol noto\'g\'ri!')
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#F5F6FA',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div style={{background:'#fff',borderRadius:16,padding:40,width:400,boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:56,height:56,background:'#1A1D2E',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <span style={{color:'#fff',fontSize:22,fontWeight:800}}>BM</span>
          </div>
          <h1 style={{fontSize:22,fontWeight:800,margin:'0 0 4px'}}>BM Auto Time</h1>
          <p style={{color:'#6B7280',fontSize:13,margin:0}}>Boshqaruv tizimiga kiring</p>
        </div>

        {error && (
          <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',color:'#DC2626',fontSize:13,marginBottom:16}}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@gmail.com"
              required
              style={{width:'100%',padding:'10px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,fontFamily:'sans-serif',outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:5}}>Parol</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{width:'100%',padding:'10px 12px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,fontFamily:'sans-serif',outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{width:'100%',padding:'11px',background: loading ? '#9CA3AF' : '#1A1D2E',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor: loading ? 'not-allowed' : 'pointer'}}
          >
            {loading ? 'Kirish...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  )
}
