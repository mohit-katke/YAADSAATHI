const endpoint = import.meta.env.VITE_BHASHINI_PROXY_URL || ''
const configuredLanguages = new Set(
  String(import.meta.env.VITE_BHASHINI_SUPPORTED_LANGUAGES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

export const bhashiniConfig = {
  endpoint,
  configuredLanguages,
  configured: Boolean(endpoint && configuredLanguages.size),
}

export function bhashiniCapability(language) {
  if (!endpoint) return { status: 'not-configured', available: false }
  if (!configuredLanguages.has(language)) return { status: 'unsupported-language', available: false }
  return { status: 'available-online', available: true }
}

export async function requestBhashiniAudio({ text, language, voice, gender }) {
  const capability = bhashiniCapability(language)
  if (!capability.available) {
    const error = new Error(capability.status)
    error.code = capability.status
    throw error
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const error = new Error('offline')
    error.code = 'offline'
    throw error
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, voice, gender }),
  })
  if (!response.ok) {
    const error = new Error(`Bhashini proxy returned ${response.status}`)
    error.code = 'provider-error'
    throw error
  }
  return response.blob()
}