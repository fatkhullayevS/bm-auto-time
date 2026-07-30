/** Summa input mask: 3000000 → "3.000.000" */

export function formatMoneyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  // oldingi nolarni olib tashlash (lekin bitta "0" qolishi mumkin emas — summa uchun)
  const normalized = digits.replace(/^0+(?=\d)/, '')
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "3.000.000" → 3000000 */
export function parseMoneyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits)
}
