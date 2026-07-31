import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoneyInput, parseMoneyInput } from '../lib/moneyMask'
import { notifyTelegram } from '../lib/notifyTelegram'
import { checkViewPassword } from '../lib/checkPassword'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0)) + " so'm"
const fmtNum = (n) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(Number(n) || 0)

const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Tashkent',
})

function nowTashkentLocal() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

function tashkentToIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null
  return new Date(Date.UTC(y, m - 1, d, hh - 5, mm, 0)).toISOString()
}

function normalizePlate(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, '')
}

export default function Gas({ session, canWrite, isBoss }) {
  const [loading, setLoading] = useState(true)
  const [fillings, setFillings] = useState([])
  const [allocations, setAllocations] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [tab, setTab] = useState('fillings') // fillings | allocations | vehicles
  const [filterPlate, setFilterPlate] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [modal, setModal] = useState(null) // 'allocate' | 'fill' | 'vehicle' | null
  const [showPassModal, setShowPassModal] = useState(false)
  const [savePass, setSavePass] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'allocate' | 'fill'

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // { type, id }
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [allocForm, setAllocForm] = useState({ amount: '', date: '', time: '', notes: '' })
  const [vehicleForm, setVehicleForm] = useState({ plate_number: '', notes: '' })
  const [fillForm, setFillForm] = useState({
    plate_number: '',
    volume: '',
    price_per_m3: '',
    date: '',
    time: '',
    notes: '',
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: fills }, { data: allocs }, { data: vehs }] = await Promise.all([
      supabase.from('gas_fillings').select('*, profiles(full_name)').order('filled_at', { ascending: false }),
      supabase.from('gas_allocations').select('*, profiles(full_name)').order('allocated_at', { ascending: false }),
      supabase.from('gas_vehicles').select('*, profiles(full_name)').order('plate_number'),
    ])
    setFillings(fills || [])
    setAllocations(allocs || [])
    setVehicles(vehs || [])
    setLoading(false)
  }

  const allocatedTotal = allocations.reduce((s, a) => s + Number(a.amount), 0)
  const spentTotal = fillings.reduce((s, r) => s + Number(r.total_amount), 0)
  const remaining = allocatedTotal - spentTotal

  const plateOptions = [...new Set([
    ...vehicles.map((v) => v.plate_number),
    ...fillings.map((r) => r.plate_number),
  ].filter(Boolean))].sort()

  const spentByPlate = {}
  fillings.forEach((r) => {
    spentByPlate[r.plate_number] = (spentByPlate[r.plate_number] || 0) + Number(r.total_amount)
  })

  const filteredFillings = fillings.filter((r) => {
    if (filterPlate && r.plate_number !== filterPlate) return false
    if (dateFrom && new Date(r.filled_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(r.filled_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const volumeNum = parseFloat(String(fillForm.volume).replace(',', '.')) || 0
  const priceNum = parseMoneyInput(fillForm.price_per_m3)
  const fillTotalPreview = volumeNum > 0 && priceNum > 0 ? Math.round(volumeNum * priceNum) : 0

  const openAllocate = () => {
    const now = nowTashkentLocal()
    setAllocForm({ amount: '', date: now.date, time: now.time, notes: '' })
    setModal('allocate')
  }

  const openFill = () => {
    const now = nowTashkentLocal()
    setFillForm({
      plate_number: vehicles[0]?.plate_number || '',
      volume: '',
      price_per_m3: '',
      date: now.date,
      time: now.time,
      notes: '',
    })
    setModal('fill')
  }

  const openVehicle = () => {
    setVehicleForm({ plate_number: '', notes: '' })
    setModal('vehicle')
  }

  const saveVehicle = async () => {
    const plate = normalizePlate(vehicleForm.plate_number)
    if (!plate) return alert('Mashina raqamini kiriting!')
    setSaving(true)
    const { error } = await supabase.from('gas_vehicles').insert([{
      plate_number: plate,
      notes: vehicleForm.notes?.trim() || null,
      created_by: session.user.id,
    }])
    setSaving(false)
    if (error) {
      if (error.code === '23505') return alert('Bu raqam allaqachon mavjud')
      return alert('Xato: ' + error.message)
    }
    setModal(null)
    loadAll()
  }

  const requestAllocate = () => {
    const amountNum = parseMoneyInput(allocForm.amount)
    if (!amountNum || amountNum <= 0) return alert('Summa kiriting!')
    if (!allocForm.date || !allocForm.time) return alert('Sana va soatni kiriting!')
    if (!tashkentToIso(allocForm.date, allocForm.time)) return alert("Sana yoki soat noto'g'ri!")
    setPendingAction('allocate')
    setSavePass('')
    setShowPassModal(true)
  }

  const requestFill = () => {
    const plate = normalizePlate(fillForm.plate_number)
    if (!plate) return alert('Mashina raqamini kiriting!')
    if (!volumeNum || volumeNum <= 0) return alert('Gaz kubini kiriting!')
    if (!priceNum || priceNum <= 0) return alert('Kub narxini kiriting!')
    if (!fillForm.date || !fillForm.time) return alert('Sana va soatni kiriting!')
    if (!tashkentToIso(fillForm.date, fillForm.time)) return alert("Sana yoki soat noto'g'ri!")
    if (fillTotalPreview > remaining) {
      return alert(`Gaz byudjetida yetarli mablag' yo'q!\nQolgan: ${fmt(remaining)}\nKerak: ${fmt(fillTotalPreview)}`)
    }
    setPendingAction('fill')
    setSavePass('')
    setShowPassModal(true)
  }

  const confirmSave = async () => {
    if (!savePass) return alert('Parolni kiriting!')
    const ok = await checkViewPassword(savePass)
    if (!ok) return alert("Parol noto'g'ri!")

    setSaving(true)
    setShowPassModal(false)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single()

    if (pendingAction === 'allocate') {
      const amountNum = parseMoneyInput(allocForm.amount)
      const allocatedAt = tashkentToIso(allocForm.date, allocForm.time)
      const { error } = await supabase.from('gas_allocations').insert([{
        amount: amountNum,
        notes: allocForm.notes?.trim() || null,
        allocated_at: allocatedAt,
        created_by: session.user.id,
      }])
      setSaving(false)
      setSavePass('')
      if (error) return alert('Xato: ' + error.message)

      notifyTelegram('gas_allocation', {
        amount: amountNum,
        notes: allocForm.notes?.trim() || '',
        created_by_name: profile?.full_name || '',
        allocated_at: fmtDate(allocatedAt),
        remaining_after: allocatedTotal + amountNum - spentTotal,
      })

      setModal(null)
      loadAll()
      return
    }

    // fill
    const plate = normalizePlate(fillForm.plate_number)
    const filledAt = tashkentToIso(fillForm.date, fillForm.time)
    const total = Math.round(volumeNum * priceNum)

    if (total > remaining) {
      setSaving(false)
      return alert(`Gaz byudjetida yetarli mablag' yo'q! Qolgan: ${fmt(remaining)}`)
    }

    const { error } = await supabase.from('gas_fillings').insert([{
      plate_number: plate,
      volume_m3: volumeNum,
      price_per_m3: priceNum,
      total_amount: total,
      filled_at: filledAt,
      notes: fillForm.notes?.trim() || null,
      created_by: session.user.id,
    }])
    setSaving(false)
    setSavePass('')
    if (error) return alert('Xato: ' + error.message)

    // Raqam ro'yxatda yo'q bo'lsa — avtomatik qo'shamiz
    if (!vehicles.some((v) => v.plate_number === plate)) {
      await supabase.from('gas_vehicles').insert([{
        plate_number: plate,
        created_by: session.user.id,
      }]).then(() => {}).catch(() => {})
    }

    notifyTelegram('gas_filling', {
      plate_number: plate,
      volume_m3: volumeNum,
      price_per_m3: priceNum,
      total_amount: total,
      filled_at: fmtDate(filledAt),
      created_by_name: profile?.full_name || '',
      notes: fillForm.notes?.trim() || '',
      remaining_after: remaining - total,
    })

    setModal(null)
    loadAll()
  }

  const openDelete = (type, id) => {
    setDeleteTarget({ type, id })
    setDeletePass('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const ok = await checkViewPassword(deletePass)
    if (!ok) return alert("Parol noto'g'ri!")
    setDeleting(true)
    const table =
      deleteTarget.type === 'allocation' ? 'gas_allocations'
        : deleteTarget.type === 'vehicle' ? 'gas_vehicles'
          : 'gas_fillings'
    const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) return alert('Xato: ' + error.message)
    setShowDeleteModal(false)
    loadAll()
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 13 }}>Yuklanmoqda...</div>
  }

  return (
    <div>
      {/* Byudjet kartochkalari */}
      <div style={{
        background: 'linear-gradient(135deg,#1A1D2E 0%,#2A2F45 100%)',
        borderRadius: 14, padding: '22px 24px', marginBottom: 20,
        boxShadow: '0 4px 20px rgba(26,29,46,.2)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Gaz byudjeti
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', minWidth: 140, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Ajratilgan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#93C5FD' }}>{fmt(allocatedTotal)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', minWidth: 140, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Sarflangan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F87171' }}>{fmt(spentTotal)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', minWidth: 140, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Qolgan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: remaining >= 0 ? '#34D399' : '#F87171' }}>{fmt(remaining)}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 12 }}>
          Kassadan faqat ajratma ayiriladi. Mashina quyishlari shu byudjetdan chiqadi.
        </div>
      </div>

      {/* Actions + tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 4 }}>
          {[
            { id: 'fillings', label: 'Quyishlar' },
            { id: 'allocations', label: 'Ajratmalar' },
            { id: 'vehicles', label: 'Mashinalar' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: tab === t.id ? '#DC2626' : 'transparent',
                color: tab === t.id ? '#fff' : '#6B7280',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fillings' && (
          <>
            <select
              value={filterPlate}
              onChange={(e) => setFilterPlate(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', minWidth: 140 }}
            >
              <option value="">Barcha mashinalar</option>
              {plateOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
          </>
        )}

        {canWrite && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openVehicle}
              style={{ background: '#fff', color: '#1A1D2E', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Mashina raqami
            </button>
            <button
              type="button"
              onClick={openAllocate}
              style={{ background: '#fff', color: '#DC2626', border: '1.5px solid #DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Umumiy ajratma
            </button>
            <button
              type="button"
              onClick={openFill}
              style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Gaz quyish
            </button>
          </div>
        )}
      </div>

      {/* Tables */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        {tab === 'fillings' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Sana', 'Raqam', 'Kub', 'Kub narxi', 'Jami', 'Kim', ...(canWrite ? [''] : [])].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFillings.length === 0 ? (
                  <tr><td colSpan={canWrite ? 7 : 6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Gaz quyishlar yo'q</td></tr>
                ) : filteredFillings.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(r.filled_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>{r.plate_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{fmtNum(r.volume_m3)} m³</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{fmt(r.price_per_m3)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{fmt(r.total_amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{r.profiles?.full_name || '—'}</td>
                    {canWrite && (
                      <td style={{ padding: '12px 16px' }}>
                        <button type="button" onClick={() => openDelete('filling', r.id)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}>
                          O'chirish
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'allocations' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Sana', 'Summa', 'Izoh', 'Kim', ...(canWrite ? [''] : [])].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr><td colSpan={canWrite ? 5 : 4} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Hali umumiy ajratma yo'q</td></tr>
                ) : allocations.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(a.allocated_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#059669' }}>+ {fmt(a.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{a.notes || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{a.profiles?.full_name || '—'}</td>
                    {canWrite && (
                      <td style={{ padding: '12px 16px' }}>
                        <button type="button" onClick={() => openDelete('allocation', a.id)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}>
                          O'chirish
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'vehicles' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Raqam', 'Sarflangan', 'Izoh', 'Qo\'shilgan', ...(canWrite ? [''] : [])].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={canWrite ? 5 : 4} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    Mashina raqamlari yo'q — «+ Mashina raqami» orqali qo'shing
                  </td></tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, letterSpacing: '.06em' }}>{v.plate_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{fmt(spentByPlate[v.plate_number] || 0)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{v.notes || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{fmtDate(v.created_at)}</td>
                    {canWrite && (
                      <td style={{ padding: '12px 16px' }}>
                        <button type="button" onClick={() => openDelete('vehicle', v.id)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}>
                          O'chirish
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — mashina raqami */}
      {modal === 'vehicle' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Mashina raqami</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>
              Yangi mashina raqamini kiriting (masalan: A020WE)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Raqam *</label>
                <input
                  value={vehicleForm.plate_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })}
                  onKeyDown={(e) => e.key === 'Enter' && saveVehicle()}
                  placeholder="A020WE"
                  style={{ ...inputStyle, letterSpacing: '.08em', fontWeight: 800, fontSize: 16 }}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Izoh</label>
                <input
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  placeholder="Ixtiyoriy (rang, model...)"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={saveVehicle} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — umumiy ajratma */}
      {modal === 'allocate' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Umumiy gaz ajratmasi</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>
              Kassadan gaz byudjetiga pul ajratiladi (masalan: 10.000.000)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Summa (so'm) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={allocForm.amount}
                  onChange={(e) => setAllocForm({ ...allocForm, amount: formatMoneyInput(e.target.value) })}
                  placeholder="10.000.000"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Sana *</label>
                  <input type="date" value={allocForm.date} onChange={(e) => setAllocForm({ ...allocForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Soat *</label>
                  <input type="time" value={allocForm.time} onChange={(e) => setAllocForm({ ...allocForm, time: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Izoh</label>
                <input value={allocForm.notes} onChange={(e) => setAllocForm({ ...allocForm, notes: e.target.value })} placeholder="Ixtiyoriy..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={requestAllocate} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Saqlash</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — quyish */}
      {modal === 'fill' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Gaz quyish</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
              Qolgan byudjet: <strong style={{ color: remaining >= 0 ? '#059669' : '#DC2626' }}>{fmt(remaining)}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Mashina raqami *</label>
                {vehicles.length > 0 ? (
                  <select
                    value={fillForm.plate_number}
                    onChange={(e) => setFillForm({ ...fillForm, plate_number: e.target.value })}
                    style={{ ...inputStyle, background: '#fff', fontWeight: 700, letterSpacing: '.06em' }}
                  >
                    <option value="">Tanlang...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.plate_number}>{v.plate_number}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={fillForm.plate_number}
                    onChange={(e) => setFillForm({ ...fillForm, plate_number: e.target.value.toUpperCase() })}
                    placeholder="A020WE"
                    style={{ ...inputStyle, letterSpacing: '.06em', fontWeight: 700 }}
                  />
                )}
                {vehicles.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { setModal(null); openVehicle() }}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    + Avval mashina raqami qo'shing
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Gaz kubi (m³) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fillForm.volume}
                    onChange={(e) => setFillForm({ ...fillForm, volume: e.target.value.replace(/[^\d.,]/g, '') })}
                    placeholder="20"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>1 kub narxi (so'm) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fillForm.price_per_m3}
                    onChange={(e) => setFillForm({ ...fillForm, price_per_m3: formatMoneyInput(e.target.value) })}
                    placeholder="5.600"
                    style={inputStyle}
                  />
                </div>
              </div>
              {fillTotalPreview > 0 && (
                <div style={{
                  background: fillTotalPreview > remaining ? '#FEF2F2' : '#ECFDF5',
                  border: `1px solid ${fillTotalPreview > remaining ? '#FECACA' : '#A7F3D0'}`,
                  borderRadius: 8, padding: '12px 14px', fontSize: 13,
                  color: fillTotalPreview > remaining ? '#991B1B' : '#065F46',
                }}>
                  Jami: <strong>{fmtNum(volumeNum)} × {fmt(priceNum)} = {fmt(fillTotalPreview)}</strong>
                  {fillTotalPreview > remaining && <div style={{ marginTop: 4, fontSize: 12 }}>Byudjet yetarli emas!</div>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Sana *</label>
                  <input type="date" value={fillForm.date} onChange={(e) => setFillForm({ ...fillForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Soat *</label>
                  <input type="time" value={fillForm.time} onChange={(e) => setFillForm({ ...fillForm, time: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Izoh</label>
                <input value={fillForm.notes} onChange={(e) => setFillForm({ ...fillForm, notes: e.target.value })} placeholder="Ixtiyoriy..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={requestFill} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Saqlash</button>
            </div>
          </div>
        </div>
      )}

      {showPassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Parolni tasdiqlang</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              {pendingAction === 'allocate' ? 'Ajratmani' : 'Gaz quyishni'} saqlash uchun parolni kiriting.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Parol</label>
              <input
                type="password"
                value={savePass}
                onChange={(e) => setSavePass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && confirmSave()}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowPassModal(false); setSavePass('') }} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={confirmSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saqlanmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>O'chirish</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Bu amalni qaytarib bo'lmaydi. Parolni kiriting.</p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Parol</label>
              <input type="password" value={deletePass} onChange={(e) => setDeletePass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmDelete()} placeholder="••••••••" style={inputStyle} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Bekor</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
