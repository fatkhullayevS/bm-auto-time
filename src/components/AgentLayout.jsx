import { clearAgentSession } from '../lib/agentSession'

export default function AgentLayout({ agent, children, onLogout }) {
  const handleLogout = () => {
    clearAgentSession()
    onLogout?.()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F6FA', overflow: 'hidden', fontFamily: "'Manrope',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Nunito:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;border:none;width:100%;text-align:left;font-size:13px;font-weight:500;font-family:inherit;transition:all .15s;color:#fff;background:rgba(220,38,38,.2)}
        .nav-icon{width:28px;height:28px;border-radius:7px;background:#DC2626;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .sidebar{position:fixed;top:0;left:0;height:100vh;width:240px;background:#1A1D2E;display:flex;flex-direction:column;z-index:30}
        .main-content{flex:1;display:flex;flex-direction:column;overflow:hidden;margin-left:240px}
        @media(max-width:1023px){
          .sidebar{width:100%;height:auto;position:relative}
          .main-content{margin-left:0}
          .agent-shell{flex-direction:column}
        }
      `}</style>

      <div className="agent-shell" style={{ display: 'flex', width: '100%', height: '100%' }}>
        <aside className="sidebar">
          <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, background: '#DC2626', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 13 }}>BM</span>
              </div>
              <div>
                <div style={{ color: '#fff', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>BM Auto Time</div>
                <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 500 }}>Ma'sul paneli</div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: '12px 10px' }}>
            <div style={{ color: 'rgba(160,168,192,.5)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 12px 5px' }}>Asosiy</div>
            <button className="nav-btn" type="button">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              O'quvchilarim
            </button>
          </nav>

          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#DC2626,#991B1B)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{(agent?.full_name || 'M')[0]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent?.full_name || "Ma'sul"}</div>
                <div style={{ color: '#6B7280', fontSize: 11 }}>Ma'sul</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Chiqish"
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 4, fontFamily: 'inherit' }}
                onMouseOver={(e) => (e.target.style.color = '#EF4444')}
                onMouseOut={(e) => (e.target.style.color = '#6B7280')}
              >
                Chiqish
              </button>
            </div>
          </div>
        </aside>

        <div className="main-content">
          <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 16px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h1 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 17, color: '#1A1D2E' }}>O'quvchilarim</h1>
          </header>
          <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{children}</main>
        </div>
      </div>
    </div>
  )
}
