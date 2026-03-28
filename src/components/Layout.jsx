import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Layout({ session, children, currentPage, setCurrentPage, onPaymentClick }) {
  const [profile, setProfile] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const isBoss = profile?.role === 'boss'

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', section: 'Asosiy' },
    { id: 'students', label: "O'quvchilar", icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', section: 'Asosiy' },
    { id: 'groups', label: 'Guruhlar', icon: 'M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.54 15.46 0 12.34 0c-1.61 0-3.07.67-4.12 1.74L7 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z', section: 'Asosiy' },
    { id: 'teachers', label: "O'qituvchilar", icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', section: 'Asosiy' },
    { id: 'payments', label: "To'lovlar", icon: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z', section: 'Moliya' },
    { id: 'reports', label: 'Hisobotlar', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z', section: 'Moliya' },
    { id: 'search', label: 'Qidiruv', icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z', section: 'Boshqa' },
    { id: 'archive', label: 'Arxiv', icon: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z', section: 'Boshqa', bossOnly: true },
    { id: 'admins', label: 'Adminlar', icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', section: 'Boshqa', bossOnly: true },
  ]

  const sections = [...new Set(navItems.map(i => i.section))]

  const handleNav = (id) => {
    setCurrentPage(id)
    setMobileOpen(false)
  }

  const NavIcon = ({ path }) => (
    <svg viewBox="0 0 24 24" style={{width:16,height:16,fill:'currentColor',flexShrink:0}}>
      <path d={path}/>
    </svg>
  )

  return (
    <div style={{display:'flex',height:'100vh',background:'#F5F6FA',overflow:'hidden',fontFamily:"'Manrope',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Nunito:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;border:none;width:100%;text-align:left;font-size:13px;font-weight:500;font-family:inherit;transition:all .15s;color:#A0A8C0;background:transparent}
        .nav-btn:hover{background:rgba(255,255,255,.06);color:#fff}
        .nav-btn.active{background:rgba(220,38,38,.2);color:#fff}
        .nav-icon{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .nav-btn.active .nav-icon{background:#DC2626}
        .sidebar{position:fixed;top:0;left:0;height:100vh;width:240px;background:#1A1D2E;display:flex;flex-direction:column;z-index:30;transition:transform .25s ease}
        .sidebar.closed{transform:translateX(-100%)}
        .sidebar.open{transform:translateX(0)}
        .main-content{flex:1;display:flex;flex-direction:column;overflow:hidden;transition:margin .25s ease}
        @media(min-width:1024px){
          .sidebar{transform:translateX(0) !important}
          .main-content{margin-left:240px}
          .hamburger{display:none !important}
        }
        @media(max-width:1023px){
          .main-content{margin-left:0}
        }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#374151;border-radius:2px}
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:20}} />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileOpen ? 'open' : 'closed'}`}>
        <div style={{padding:'20px 16px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:38,height:38,background:'#DC2626',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{color:'#fff',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:13}}>BM</span>
            </div>
            <div>
              <div style={{color:'#fff',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:15,lineHeight:1.2}}>BM Auto Time</div>
              <div style={{color:'#6B7280',fontSize:11,fontWeight:500}}>Boshqaruv tizimi</div>
            </div>
          </div>
        </div>

        <nav style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
          {sections.map(section => (
            <div key={section} style={{marginBottom:8}}>
              <div style={{color:'rgba(160,168,192,.5)',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',padding:'10px 12px 5px'}}>{section}</div>
              {navItems.filter(i => i.section === section).filter(i => !i.bossOnly || isBoss).map(item => (
                <button key={item.id} className={`nav-btn${currentPage===item.id?' active':''}`} onClick={() => handleNav(item.id)}>
                  <div className="nav-icon"><NavIcon path={item.icon}/></div>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div style={{padding:'14px 16px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,background:'linear-gradient(135deg,#DC2626,#991B1B)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{color:'#fff',fontSize:13,fontWeight:700}}>{(profile?.full_name||'U')[0]}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'#fff',fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.full_name||'Foydalanuvchi'}</div>
              <div style={{color:'#6B7280',fontSize:11}}>{isBoss?'Boss':profile?.role==='viewer'?'Kuzatuvchi':'Kassir'}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} style={{background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:20,padding:4,lineHeight:1}} onMouseOver={e=>e.target.style.color='#EF4444'} onMouseOut={e=>e.target.style.color='#6B7280'}>×</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <header style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'0 16px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="hamburger" onClick={() => setMobileOpen(true)} style={{background:'none',border:'none',cursor:'pointer',padding:6,borderRadius:8,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <h1 style={{fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:17,color:'#1A1D2E'}}>
              {navItems.find(i => i.id === currentPage)?.label || 'Dashboard'}
            </h1>
          </div>
          <button onClick={onPaymentClick} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            + To'lov
          </button>
        </header>

        <main style={{flex:1,overflowY:'auto',padding:16}}>
          {children}
        </main>
      </div>
    </div>
  )
}
