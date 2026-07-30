import { useState, useEffect } from 'react'
import { agentGetStudents, agentAddPayment } from '../lib/agentApi'
import { formatMoneyInput, parseMoneyInput } from '../lib/moneyMask'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm"

export default function AgentStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('') // '' | debt | paid
  const [payStudent, setPayStudent] = useState(null)
  const [form, setForm] = useState({ amount: '', method: 'cash', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await agentGetStudents()
    if (err) {
      setError(err)
      setStudents([])
    } else {
      setStudents(data?.students || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter((st) => {
    if (filter === 'debt' && st.debt <= 0) return false
    if (filter === 'paid' && st.debt > 0) return false
    return true
  })

  const openPay = (st, e) => {
    e?.stopPropagation?.()
    setPayStudent(st)
    setForm({ amount: st.debt > 0 ? formatMoneyInput(st.debt) : '', method: 'cash', notes: '' })
  }

  const closePay = () => {
    setPayStudent(null)
    setForm({ amount: '', method: 'cash', notes: '' })
  }

  const savePay = async () => {
    if (!payStudent) return
    const amountNum = parseMoneyInput(form.amount)
    if (!amountNum || amountNum <= 0) return alert('Summa kiriting!')
    setSaving(true)
    const { error: err } = await agentAddPayment({
      studentId: payStudent.id,
      amount: amountNum,
      method: form.method,
      notes: form.notes,
    })
    setSaving(false)
    if (err) return alert(err)
    closePay()
    load()
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Barcha holat</option>
          <option value="debt">Qarz bor</option>
          <option value="paid">To'liq to'lagan</option>
        </select>
        <button onClick={load} style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280' }}>
          Yangilash
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 14px', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>O'quvchilar yo'q</div>
        ) : filtered.map((st) => (
          <div key={st.id} style={{ padding: '14px 18px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {st.full_name?.[0] || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{st.full_name}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{st.group_name || 'Guruhsiz'}{st.phone ? ` · ${st.phone}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>To'langan</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmt(st.paid)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Qarz</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: st.debt > 0 ? '#DC2626' : '#9CA3AF' }}>{st.debt > 0 ? fmt(st.debt) : '—'}</div>
              </div>
              <button
                type="button"
                onClick={(e) => openPay(st, e)}
                style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                + To'lov
              </button>
            </div>
          </div>
        ))}
      </div>

      {payStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && closePay()}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>To'lov kiritish</h2>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#991B1B' }}>{payStudent.full_name}</div>
              <div style={{ color: '#DC2626', fontSize: 12, marginTop: 2 }}>
                Kurs: {fmt(payStudent.course_price || 0)} · To'langan: {fmt(payStudent.paid)} · Qarz: {fmt(payStudent.debt)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Summa (so'm) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: formatMoneyInput(e.target.value) })}
                  placeholder="3.000.000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>To'lov usuli</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: 'cash', label: 'Naqd pul' }, { val: 'card', label: 'Karta' }].map((m) => (
                    <div
                      key={m.val}
                      onClick={() => setForm({ ...form, method: m.val })}
                      style={{
                        flex: 1,
                        padding: 9,
                        border: `1.5px solid ${form.method === m.val ? '#DC2626' : '#E5E7EB'}`,
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: form.method === m.val ? '#FEF2F2' : '#fff',
                        color: form.method === m.val ? '#DC2626' : '#6B7280',
                      }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Izoh</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ixtiyoriy..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closePay} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={savePay} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
