export async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function newId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`
}

export function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizeMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function looksLikeEmail(value) {
  return String(value || '').includes('@')
}
