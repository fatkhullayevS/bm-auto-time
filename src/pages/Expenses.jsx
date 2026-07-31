import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoneyInput, parseMoneyInput } from '../lib/moneyMask'
import { notifyTelegram } from '../lib/notifyTelegram'
import { checkViewPassword } from '../lib/checkPassword'

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0)) + " so'm"
const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Tashkent',
})

/** Hozirgi sana/soat (Asia/Tashkent) — input defaultlari uchun */
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

/** Tashkent sana+soat → ISO (UTC). Tashkent = UTC+5, DST yo'q */
function tashkentToIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null
  return new Date(Date.UTC(y, m - 1, d, hh - 5, mm, 0)).toISOString()
}

function tashkentDateEndIso(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 18, 59, 59, 999)).toISOString()
}

function fmtPeriod(from, to) {
  const f = (d) => {
    if (!d) return '—'
    const [y, m, day] = String(d).slice(0, 10).split('-')
    return `${day}.${m}.${y}`
  }
  if (!from && !to) return null
  return `${f(from)} — ${f(to)}`
}

export default function Expenses({ session, canWrite }) {
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [totalPayments, setTotalPayments] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [savePass, setSavePass] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deletePass, setDeletePass] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [expType, setExpType] = useState('normal') // normal | general
  const [form, setForm] = useState({
    category_id: '',
    newCategory: '',
    useNewCategory: false,
    amount: '',
    description: '',
    date: '',
    time: '',
    periodFrom: '',
    periodTo: '',
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: cats }, { data: exps }, { data: pays }] = await Promise.all([
      supabase.from('expense_categories').select('id, name').order('name'),
      supabase
        .from('expenses')
        .select('*, expense_categories(name), profiles(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('payments').select('amount'),
    ])

    const expenseList = exps || []
    const paySum = (pays || []).reduce((s, p) => s + Number(p.amount), 0)
    const expSum = expenseList.reduce((s, e) => s + Number(e.amount), 0)

    setCategories(cats || [])
    setExpenses(expenseList)
    setTotalPayments(paySum)
    setTotalExpenses(expSum)
    setLoading(false)
  }

  const balance = totalPayments - totalExpenses

  const filtered = expenses.filter((e) => {
    if (filterCategory === '__general__') {
      if (e.category_id) return false
    } else if (filterCategory && e.category_id !== filterCategory) {
      return false
    }
    if (dateFrom && new Date(e.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(e.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  // Kategoriya taqsimoti — kategoriyalar + umumiy
  const spentById = {}
  let generalSpent = 0
  expenses.forEach((e) => {
    if (!e.category_id) {
      generalSpent += Number(e.amount)
      return
    }
    const id = e.category_id
    spentById[id] = (spentById[id] || 0) + Number(e.amount)
  })
  const categoryRows = [
    ...categories.map((c) => {
      const amount = spentById[c.id] || 0
      return {
        id: c.id,
        name: c.name,
        amount,
        pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }
    }),
    ...(generalSpent > 0 || expenses.some((e) => !e.category_id)
      ? [{
          id: '__general__',
          name: "Umumiy rasxot",
          amount: generalSpent,
          pct: totalExpenses > 0 ? (generalSpent / totalExpenses) * 100 : 0,
        }]
      : []),
  ].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  const openAdd = () => {
    const now = nowTashkentLocal()
    setExpType('normal')
    setForm({
      category_id: categories[0]?.id || '',
      newCategory: '',
      useNewCategory: false,
      amount: '',
      description: '',
      date: now.date,
      time: now.time,
      periodFrom: '',
      periodTo: '',
    })
    setShowModal(true)
  }

  const openCatModal = () => {
    setNewCatName('')
    setShowCatModal(true)
  }

  const saveCategory = async () => {
    const name = newCatName.trim()
    if (!name) return alert('Kategoriya nomini kiriting!')
    setSavingCat(true)
    const { data, error } = await supabase
      .from('expense_categories')
      .insert([{ name }])
      .select('id, name')
      .single()
    setSavingCat(false)
    if (error) {
      if (error.code === '23505') return alert('Bu kategoriya allaqachon mavjud')
      return alert(error.message)
    }
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setShowCatModal(false)
    setNewCatName('')
  }

  const requestSaveExpense = () => {
    const amountNum = parseMoneyInput(form.amount)
    if (!amountNum || amountNum <= 0) return alert('Summa kiriting!')

    if (expType === 'general') {
      if (!form.periodFrom || !form.periodTo) return alert('Davr sanasini tanlang (dan — gacha)!')
      if (form.periodFrom > form.periodTo) return alert("Boshlanish sanasi oxiridan oldin bo'lishi kerak!")
    } else {
      if (!form.category_id) return alert('Kategoriya tanlang!')
      if (!form.date || !form.time) return alert('Sana va soatni kiriting!')
      const createdAt = tashkentToIso(form.date, form.time)
      if (!createdAt) return alert("Sana yoki soat noto'g'ri!")
    }

    setSavePass('')
    setShowPassModal(true)
  }

  const confirmSaveExpense = async () => {
    if (!savePass) return alert('Parolni kiriting!')
    const ok = await checkViewPassword(savePass)
    if (!ok) return alert("Parol noto'g'ri!")

    const amountNum = parseMoneyInput(form.amount)
    setSaving(true)
    setShowPassModal(false)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single()

    if (expType === 'general') {
      const createdAt = tashkentDateEndIso(form.periodTo)
      const periodLabel = fmtPeriod(form.periodFrom, form.periodTo)
      const descParts = [
        form.description?.trim() || '',
        periodLabel ? `Davr: ${periodLabel}` : '',
      ].filter(Boolean)

      const { error } = await supabase.from('expenses').insert([{
        category_id: null,
        amount: amountNum,
        description: descParts.join(' · ') || null,
        created_by: session.user.id,
        created_at: createdAt,
        period_from: form.periodFrom,
        period_to: form.periodTo,
      }])
      setSaving(false)
      setSavePass('')
      if (error) return alert('Xato: ' + error.message)

      notifyTelegram('general_expense', {
        amount: amountNum,
        period: periodLabel,
        description: form.description?.trim() || '',
        created_by_name: profile?.full_name || '',
      })

      setShowModal(false)
      loadAll()
      return
    }

    const createdAt = tashkentToIso(form.date, form.time)
    const { error } = await supabase.from('expenses').insert([{
      category_id: form.category_id,
      amount: amountNum,
      description: form.description?.trim() || null,
      created_by: session.user.id,
      created_at: createdAt,
    }])
    setSaving(false)
    setSavePass('')

    if (error) return alert('Xato: ' + error.message)

    const categoryName = categories.find((c) => c.id === form.category_id)?.name || ''
    notifyTelegram('expense', {
      category_name: categoryName,
      amount: amountNum,
      description: form.description?.trim() || '',
      created_by_name: profile?.full_name || '',
      spent_at: fmtDate(createdAt),
    })

    setShowModal(false)
    loadAll()
  }

  const openDelete = (id) => {
    setDeleteId(id)
    setDeletePass('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'view_password').single()
    if (deletePass !== data?.value) return alert("Parol noto'g'ri!")
    setDeleting(true)
    const { error } = await supabase.from('expenses').delete().eq('id', deleteId)
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
      {/* Kassa balansi */}
      <div style={{
        background: 'linear-gradient(135deg,#1A1D2E 0%,#2A2F45 100%)',
        borderRadius: 14, padding: '22px 24px', marginBottom: 20,
        display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        boxShadow: '0 4px 20px rgba(26,29,46,.2)',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Joriy kassa balansi
          </div>
          <div style={{
            fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 32,
            color: balance >= 0 ? '#34D399' : '#F87171',
          }}>
            {fmt(balance)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 6 }}>
            Tushum − Rasxot
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Tushum</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#34D399' }}>{fmt(totalPayments)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Rasxot</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F87171' }}>{fmt(totalExpenses)}</div>
          </div>
        </div>
      </div>

      {/* Kategoriya taqsimoti */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
        padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Kategoriya bo'yicha taqsimot</div>
          {canWrite && (
            <button
              type="button"
              onClick={openCatModal}
              style={{
                background: '#F3F4F6', color: '#1A1D2E', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              + Kategoriya qo'shish
            </button>
          )}
        </div>
        {categoryRows.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>
            Hali kategoriya yo'q — yuqoridan qo'shing
          </div>
        ) : categoryRows.map((row) => (
          <div key={row.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1D2E' }}>{row.name}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.amount > 0 ? '#6B7280' : '#9CA3AF' }}>
                {fmt(row.amount)} · {row.pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.min(100, row.pct)}%`,
                background: row.amount > 0 ? '#DC2626' : '#E5E7EB',
                borderRadius: 4, transition: 'width .3s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter + qo'shish */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', minWidth: 160 }}
        >
          <option value="">Barcha kategoriyalar</option>
          <option value="__general__">Umumiy rasxot</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
        <span style={{ color: '#9CA3AF', fontSize: 13 }}>dan</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
        {(filterCategory || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setFilterCategory(''); setDateFrom(''); setDateTo('') }}
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280' }}
          >
            Tozalash ×
          </button>
        )}
        {canWrite && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openCatModal}
              style={{ background: '#fff', color: '#DC2626', border: '1.5px solid #DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Kategoriya
            </button>
            <button
              type="button"
              onClick={openAdd}
              style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Rasxot qo'shish
            </button>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>{filtered.length} ta rasxot</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>
            {fmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
          </span>
        </div>
      )}

      {/* Ro'yxat */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Sana', 'Kategoriya', 'Summa', 'Izoh', 'Kim', ...(canWrite ? [''] : [])].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                    color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em',
                    borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 6 : 5} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    Rasxotlar yo'q
                  </td>
                </tr>
              ) : filtered.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F9FAFB' }}
                  onMouseOver={(ev) => (ev.currentTarget.style.background = '#FAFBFF')}
                  onMouseOut={(ev) => (ev.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {e.period_from || e.period_to
                      ? (fmtPeriod(e.period_from, e.period_to) || fmtDate(e.created_at))
                      : fmtDate(e.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>
                    {e.category_id
                      ? (e.expense_categories?.name || '—')
                      : "Umumiy rasxot"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{fmt(e.amount)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280', maxWidth: 220 }}>
                    {e.description || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{e.profiles?.full_name || '—'}</td>
                  {canWrite && (
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openDelete(e.id)}
                        style={{
                          background: '#FEF2F2', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                          color: '#DC2626', fontFamily: 'inherit', fontWeight: 600,
                        }}
                      >
                        O'chirish
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — rasxot */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
              Rasxot qo'shish
            </h2>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[
                { val: 'normal', label: 'Oddiy rasxot' },
                { val: 'general', label: 'Umumiy rasxot' },
              ].map((t) => (
                <div
                  key={t.val}
                  onClick={() => setExpType(t.val)}
                  style={{
                    flex: 1, padding: '9px', border: `1.5px solid ${expType === t.val ? '#DC2626' : '#E5E7EB'}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                    background: expType === t.val ? '#FEF2F2' : '#fff',
                    color: expType === t.val ? '#DC2626' : '#6B7280',
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {expType === 'normal' ? (
                <>
                  <div>
                    <label style={labelStyle}>Kategoriya *</label>
                    <select
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      style={{ ...inputStyle, background: '#fff' }}
                    >
                      <option value="">Tanlang...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); openCatModal() }}
                      style={{
                        marginTop: 8, background: 'none', border: 'none', color: '#DC2626',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                      }}
                    >
                      + Yangi kategoriya qo'shish
                    </button>
                  </div>

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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Sana *</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Soat *</label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Sana (dan) *</label>
                      <input
                        type="date"
                        value={form.periodFrom}
                        onChange={(e) => setForm({ ...form, periodFrom: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Sana (gacha) *</label>
                      <input
                        type="date"
                        value={form.periodTo}
                        onChange={(e) => setForm({ ...form, periodTo: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

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

                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                    padding: '10px 14px', fontSize: 12, color: '#991B1B',
                  }}>
                    Bu rasxot kategoriyaga bog'lanmaydi — faqat kassa balansidan ayiriladi.
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Izoh</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ixtiyoriy izoh..."
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={requestSaveExpense}
                disabled={saving}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parol — yashirin */}
      {showPassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,.15)',
          }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Parolni tasdiqlang
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              Rasxotni saqlash uchun parolni kiriting.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Parol</label>
              <input
                type="password"
                value={savePass}
                onChange={(e) => setSavePass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && confirmSaveExpense()}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowPassModal(false); setSavePass('') }}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={confirmSaveExpense}
                disabled={saving}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'Saqlanmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — kategoriya */}
      {showCatModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && setShowCatModal(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,.15)',
          }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Kategoriya qo'shish
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              Yangi rasxot kategoriyasi nomini kiriting
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nomi *</label>
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCategory()}
                placeholder="Masalan: Ofis harajatlari"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={saveCategory}
                disabled={savingCat}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {savingCat ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — o'chirish */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Rasxotni o'chirish</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Bu amalni qaytarib bo'lmaydi. Summalarni ko'rish parolini kiriting.</p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Parol</label>
              <input
                type="password"
                value={deletePass}
                onChange={(e) => setDeletePass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
                placeholder="Parol kiriting..."
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Bekor
              </button>
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
