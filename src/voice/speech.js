const LANG_TO_BCP47 = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  hi: ['hi-IN', 'hi'],
  as: ['as-IN', 'as', 'bn-IN', 'bn'],
}

function voices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices() || []
}

export function pickBrowserVoice(langId) {
  const list = voices()
  const wanted = LANG_TO_BCP47[langId] || LANG_TO_BCP47.en
  for (const code of wanted) {
    const exact = list.find((v) => v.lang?.toLowerCase() === code.toLowerCase())
    if (exact) return { voice: exact, matchedLang: langId, fallback: false }
    const prefix = code.split('-')[0].toLowerCase()
    const loose = list.find((v) => v.lang?.toLowerCase().startsWith(prefix))
    if (loose) return { voice: loose, matchedLang: langId, fallback: prefix !== langId && langId === 'as' }
  }
  if (langId === 'as') {
    const hindi = pickBrowserVoice('hi')
    if (hindi.voice) return { ...hindi, matchedLang: 'hi', fallback: true, requested: 'as' }
  }
  const english = list.find((v) => v.lang?.toLowerCase().startsWith('en')) || list[0] || null
  return {
    voice: english,
    matchedLang: 'en',
    fallback: langId !== 'en',
    requested: langId,
  }
}

export function speakWithBrowser(text, langId, { onStart, onEnd } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onStart?.()
    const t = setTimeout(() => onEnd?.(), 1200)
    return { ok: false, reason: 'no-synthesis', fallback: true, cancel: () => clearTimeout(t) }
  }
  const picked = pickBrowserVoice(langId)
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.9
  utter.lang = picked.voice?.lang || LANG_TO_BCP47[langId]?.[0] || 'en-IN'
  if (picked.voice) utter.voice = picked.voice
  utter.onstart = () => onStart?.()
  utter.onend = () => onEnd?.()
  utter.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utter)
  return {
    ok: !picked.fallback,
    fallback: Boolean(picked.fallback),
    requested: langId,
    used: picked.matchedLang,
    cancel: () => window.speechSynthesis.cancel(),
  }
}

/**
 * Voice layer: browser speech synthesis now.
 * Bhashini AI can replace `speak` later without changing screens.
 */
export const voiceEngine = {
  provider: 'browser-speech-synthesis',
  futureProvider: 'bhashini',
  speak(text, langId, hooks) {
    return speakWithBrowser(text, langId, hooks)
  },
  warm() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      window.speechSynthesis.getVoices()
    })
  },
}
