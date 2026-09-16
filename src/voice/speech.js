const LANG_TO_BCP47 = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  hi: ['hi-IN', 'hi'],
  as: ['as-IN', 'as'],
}

function voices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices() || []
}

let cachedVoices = []
const voiceListeners = new Set()

function refreshVoices() {
  cachedVoices = voices()
  voiceListeners.forEach((listener) => listener(cachedVoices))
  return cachedVoices
}

function languageMatches(voiceLanguage, requestedLanguage) {
  const actual = String(voiceLanguage || '').toLowerCase()
  const requested = String(requestedLanguage || '').toLowerCase()
  return actual === requested || actual.split('-')[0] === requested.split('-')[0]
}

function findBrowserVoice(langId, list) {
  const wanted = LANG_TO_BCP47[langId] || LANG_TO_BCP47.en
  for (const code of wanted) {
    const exact = list.find((v) => v.lang?.toLowerCase() === code.toLowerCase())
    if (exact) return { voice: exact, matchedLang: langId, fallback: false }
    const loose = list.find((v) => languageMatches(v.lang, code))
    if (loose) return { voice: loose, matchedLang: langId, fallback: false }
  }
  return {
    voice: null,
    matchedLang: langId,
    fallback: true,
    requested: langId,
  }
}

export function pickBrowserVoice(langId) {
  return findBrowserVoice(langId, refreshVoices())
}

export function getAvailableVoices() {
  return [...refreshVoices()]
}

export function isVoiceAvailable(langId) {
  const list = cachedVoices.length ? cachedVoices : voices()
  return Boolean(findBrowserVoice(langId, list).voice)
}

export function subscribeToVoiceChanges(listener) {
  voiceListeners.add(listener)
  return () => voiceListeners.delete(listener)
}

export function speakWithBrowser(text, langId, { onStart, onEnd, onError } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onStart?.()
    const t = setTimeout(() => onEnd?.(), 1200)
    return { ok: false, reason: 'no-synthesis', fallback: true, cancel: () => clearTimeout(t) }
  }
  const picked = pickBrowserVoice(langId)
  if (!picked.voice) {
    onError?.({ error: 'voice-unavailable' })
    return {
      ok: false,
      fallback: true,
      requested: langId,
      used: null,
      cancel: () => {},
    }
  }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.85
  utter.lang = picked.voice.lang
  utter.voice = picked.voice
  utter.onstart = () => onStart?.()
  utter.onend = () => onEnd?.()
  utter.onerror = (event) => {
    onError?.(event)
    onEnd?.()
  }
  window.speechSynthesis.speak(utter)
  return {
    ok: true,
    fallback: Boolean(picked.fallback),
    requested: langId,
    used: picked.matchedLang,
    cancel: () => window.speechSynthesis.cancel(),
  }
}

export const voiceEngine = {
  provider: 'browser-speech-synthesis',
  speak(text, langId, hooks) {
    return speakWithBrowser(text, langId, hooks)
  },
  warm() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    refreshVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
  },
  getAvailableVoices,
  isVoiceAvailable,
  subscribeToVoiceChanges,
}

export function startSpeechRecognition({ lang = 'en', onResult, onError, onEnd } = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported', stop: () => {} }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) return { ok: false, reason: 'unsupported', stop: () => {} }
  const recognition = new Recognition()
  recognition.lang = (LANG_TO_BCP47[lang] || LANG_TO_BCP47.en)[0]
  recognition.interimResults = false
  recognition.maxAlternatives = 3
  recognition.onresult = (event) => {
    const alternatives = Array.from(event.results?.[0] || []).map((item) => item.transcript)
    onResult?.(alternatives)
  }
  recognition.onerror = (event) => onError?.(event.error || 'recognition-error')
  recognition.onend = () => onEnd?.()
  try {
    recognition.start()
    return { ok: true, stop: () => recognition.stop() }
  } catch (error) {
    onError?.(error?.message || 'recognition-error')
    return { ok: false, reason: 'start-failed', stop: () => {} }
  }
}
