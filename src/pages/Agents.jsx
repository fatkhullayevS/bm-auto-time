import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { checkDeletePassword } from '../lib/checkPassword'
import { agentSetPassword } from '../lib/agentApi'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function Agents({ isBoss, canManageAgents, onStudentClick }) {
  const canManage = canManageAgents ?? isBoss
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentStudents, setAgentStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', login: '', password: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [passTarget, setPassTarget] = useState(null)
  const [passForm, setPassForm] = useState({ login: '', password: '' })
  const [savingPass, setSavingPass] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteStudent, setDeleteStudent] = useState(null)
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadAgents() }, [])

  const loadAgents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, phone, login, is_active')
      .order('full_name')
    if (error) console.error('Agents error:', error)
    setAgents(data || [])
    setLoading(false)
  }

  const openAgent = async (agent) => {
    setSelectedAgent(agent)
    setLoadingStudents(true)
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, phone, course_price, groups(name), payments(amount)')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    if (error) console.error('Students error:', error)
    setAgentStudents(data || [])
    setLoadingStudents(false)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ full_name: '', phone: '', login: '', password: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (a) => {
    setEditItem(a)
    setForm({
      full_name: a.full_name,
      phone: a.phone || '',
      login: a.login || '',
      password: '',
      is_active: a.is_active !== false,
    })
    setShowModal(true)
  }

  const openPassReset = (a, e) => {
    e?.stopPropagation?.()
    setPassTarget(a)
    setPassForm({ login: a.login || '', password: '' })
    setShowPassModal(true)
  }

  const save = async () => {
    if (!form.full_name.trim()) return alert('Ism kiriting!')
    if (!editItem) {
      if (!form.login.trim()) return alert('Login kiriting!')
      if (!form.password || form.password.length < 4) return alert("Parol kamida 4 belgidan iborat bo'lsin!")
    }
    setSaving(true)

    if (editItem) {
      const { error } = await supabase
        .from('agents')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          login: form.login.trim() || null,
          is_active: form.is_active,
        })
        .eq('id', editItem.id)
      if (error) {
        setSaving(false)
        return alert(error.code === '23505' ? 'Bu login band' : error.message)
      }
      if (form.password) {
        const { error: passErr } = await agentSetPassword(editItem.id, form.password, form.login.trim() || undefined)
        if (passErr) {
          setSaving(false)
          return alert("Ma'lumot saqlandi, lekin parol xatosi: " + passErr)
        }
      }
      if (selectedAgent?.id === editItem.id) {
        setSelectedAgent({
          ...selectedAgent,
          full_name: form.full_name.trim(),
          phone: form.phone,
          login: form.login.trim(),
          is_active: form.is_active,
        })
      }
    } else {
      const { data: created, error } = await supabase
        .from('agents')
        .insert([{
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          login: form.login.trim(),
          is_active: true,
        }])
        .select('id')
        .single()
      if (error) {
        setSaving(false)
        return alert(error.code === '23505' ? 'Bu login band' : error.message)
      }
      const { error: passErr } = await agentSetPassword(created.id, form.password, form.login.trim())
      if (passErr) {
        setSaving(false)
        return alert("Ma'sul yaratildi, lekin parol o'rnatilmadi: " + passErr)
      }
    }

    setShowModal(false)
    loadAgents()
    setSaving(false)
  }

  const savePassword = async () => {
    if (!passTarget) return
    if (!passForm.password || passForm.password.length < 4) return alert("Parol kamida 4 belgidan iborat bo'lsin!")
    setSavingPass(true)
    const { error } = await agentSetPassword(
      passTarget.id,
      passForm.password,
      passForm.login.trim() || undefined,
    )
    setSavingPass(false)
    if (error) return alert(error)
    alert("Parol muvaffaqiyatli o'zgartirildi")
    setShowPassModal(false)
    loadAgents()
    if (selectedAgent?.id === passTarget.id) {
      setSelectedAgent({ ...selectedAgent, login: passForm.login.trim() || selectedAgent.login })
    }
  }

  const deleteAgent = async (id, e) => {
    e.stopPropagation()
    const pass = window.prompt("O'chirish uchun maxsus parolni kiriting:")
    if (!pass) return
    const ok = await checkDeletePassword(pass)
    if (!ok) return alert("Parol noto'g'ri!")
    await supabase.from('agents').delete().eq('id', id)
    if (selectedAgent?.id === id) setSelectedAgent(null)
    loadAgents()
  }

  const openDeleteStudent = (st, e) => {
    e.stopPropagation()
    setDeleteStudent(st)
    setDeletePass('')
    setShowDeleteModal(true)
  }

  const confirmDeleteStudent = async () => {
    if (!deleteStudent) return
    const ok = await checkDeletePassword(deletePass)
    if (!ok) return alert("Parol noto'g'ri!")
    setDeleting(true)

    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', deleteStudent.id)
    const paymentIds = (pays || []).map((p) => p.id)

    if (paymentIds.length > 0) {
      await supabase.from('agent_payments_log').delete().in('payment_id', paymentIds)
      await supabase.from('payments').delete().in('id', paymentIds)
    }

    const { error } = await supabase.from('students').delete().eq('id', deleteStudent.id)
    setDeleting(false)
    if (error) return alert(error.message)

    setAgentStudents((prev) => prev.filter((s) => s.id !== deleteStudent.id))
    setShowDeleteModal(false)
    setDeleteStudent(null)
    setDeletePass('')
  }

  const getPaid = (st) => st.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
  const getDebt = (st) => Math.max(0, (st.course_price || 0) - getPaid(st))

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }

  if (selectedAgent) {
    const totalExpected = agentStudents.reduce((s, st) => s + (st.course_price || 0), 0)
    const totalPaid = agentStudents.reduce((s, st) => s + getPaid(st), 0)
    const totalDebt = agentStudents.reduce((s, st) => s + getDebt(st), 0)

    return (
      <div>
        <button onClick={() => { setSelectedAgent(null); setAgentStudents([]) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, fontFamily: 'inherit', padding: 0 }}>
          ← Orqaga
        </button>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
              {selectedAgent.full_name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18 }}>{selectedAgent.full_name}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                {selectedAgent.phone || "Telefon yo'q"}
                {selectedAgent.login ? ` · @${selectedAgent.login}` : ''}
                {selectedAgent.is_active === false ? ' · BLOKLANGAN' : ''}
              </div>
            </div>
            {canManage && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(selectedAgent)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Tahrirlash
                </button>
                <button onClick={(e) => openPassReset(selectedAgent, e)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}>
                  Parolni o'zgartirish
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            {[
              { label: "O'quvchilar", val: agentStudents.length + ' ta' },
              { label: 'Kutilgan', val: fmt(totalExpected) },
              { label: 'Tushgan', val: fmt(totalPaid), color: '#059669' },
              { label: 'Qarz', val: fmt(totalDebt), color: totalDebt > 0 ? '#DC2626' : '#9CA3AF' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color || '#1A1D2E' }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>O'quvchilar</span>
          </div>
          {loadingStudents ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Yuklanmoqda...</div>
          ) : agentStudents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>O'quvchilar yo'q</div>
          ) : agentStudents.map((st) => {
            const paid = getPaid(st)
            const debt = getDebt(st)
            return (
              <div key={st.id} onClick={() => onStudentClick && onStudentClick(st.id)} style={{ padding: '14px 18px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }} onMouseOver={(e) => (e.currentTarget.style.background = '#FAFBFF')} onMouseOut={(e) => (e.currentTarget.style.background = '')}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{st.full_name[0]}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{st.full_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{st.groups?.name || 'Guruhsiz'} · {st.phone || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{fmt(paid)}</span>
                  {debt > 0 && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#FEF2F2', color: '#DC2626' }}>Qarz: {fmt(debt)}</span>}
                  {debt === 0 && st.course_price > 0 && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#ECFDF5', color: '#059669' }}>To'liq</span>}
                  {isBoss && (
                    <button
                      onClick={(e) => openDeleteStudent(st, e)}
                      title="To'liq o'chirish"
                      style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}
                    >
                      O'chirish
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {showDeleteModal && renderDeleteModal()}
        {showPassModal && renderPassModal()}
        {showModal && renderFormModal()}
      </div>
    )
  }

  function renderDeleteModal() {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && !deleting && setShowDeleteModal(false)}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
          <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>O'quvchini to'liq o'chirish</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
            <strong>{deleteStudent?.full_name}</strong> va uning barcha to'lovlari butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi. Maxsus parolni kiriting.
          </p>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Maxsus parol</label>
            <input
              type="password"
              value={deletePass}
              onChange={(e) => setDeletePass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmDeleteStudent()}
              placeholder="Parol kiriting..."
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowDeleteModal(false)} disabled={deleting} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
            <button onClick={confirmDeleteStudent} disabled={deleting} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {deleting ? "O'chirilmoqda..." : "O'chirish"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderPassModal() {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setShowPassModal(false)}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
          <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Parolni o'zgartirish</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{passTarget?.full_name}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Login</label>
              <input value={passForm.login} onChange={(e) => setPassForm({ ...passForm, login: e.target.value })} placeholder="masul_login" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Yangi parol *</label>
              <input type="password" value={passForm.password} onChange={(e) => setPassForm({ ...passForm, password: e.target.value })} placeholder="••••••••" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowPassModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
            <button onClick={savePassword} disabled={savingPass} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {savingPass ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderFormModal() {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 20 }}>
            {editItem ? "Ma'sulni tahrirlash" : "Ma'sul qo'shish"}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Ism Familiya *</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Rahimov Sardor" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998901234567" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Login {!editItem && '*'}</label>
              <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="sardor01" style={inputStyle} autoComplete="off" />
            </div>
            <div>
              <label style={labelStyle}>{editItem ? "Yangi parol (ixtiyoriy)" : 'Parol *'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inputStyle} autoComplete="new-password" />
            </div>
            {editItem && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Faol (login ochiq)
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canManage && (
          <button onClick={openAdd} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Ma'sul qo'shish
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 13 }}>Yuklanmoqda...</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 13 }}>Ma'sullar yo'q</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {agents.map((a) => (
            <div key={a.id} onClick={() => openAgent(a)} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer', transition: 'box-shadow .15s', opacity: a.is_active === false ? 0.65 : 1 }} onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)')} onMouseOut={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  {a.full_name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.full_name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {a.login ? `@${a.login}` : 'Login yo‘q'}
                    {a.is_active === false ? ' · blok' : ''}
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(a)} title="Tahrirlash" style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                    <button onClick={(e) => openPassReset(a, e)} title="Parol" style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', color: '#DC2626' }}>🔑</button>
                    {isBoss && (
                      <button onClick={(e) => deleteAgent(a.id, e)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', color: '#DC2626' }}>×</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && renderFormModal()}
      {showPassModal && renderPassModal()}
    </div>
  )
}
