import { LANGUAGE_REGISTRY } from '../i18n/strings'
import { cacheAudio, createAudioCacheKey, getCachedAudio, getCachedAudioStatus, playCachedAudio } from './audioCache'
import { bhashiniCapability, requestBhashiniAudio } from './bhashiniClient'

const LANG_TO_BCP47 = Object.fromEntries(
  Object.entries(LANGUAGE_REGISTRY).map(([code, language]) => [code, language.browserVoiceAliases]),
)

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

export function getVoiceStatus(langId) {
  const list = cachedVoices.length ? cachedVoices : voices()
  const picked = findBrowserVoice(langId, list)
  return {
    available: Boolean(picked.voice),
    requested: langId,
    matchedLanguage: picked.voice?.lang || null,
    voiceName: picked.voice?.name || null,
  }
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

export class BrowserSpeechProvider {
  speak(text, langId, hooks) {
    return speakWithBrowser(text, langId, hooks)
  }

  warm() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    refreshVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
  }
}

export class BhashiniSpeechProvider {
  getStatus(langId) {
    return bhashiniCapability(langId)
  }

  canSpeak(langId) {
    return this.getStatus(langId).available
  }

  async synthesize(text, langId, settings) {
    return requestBhashiniAudio({
      text,
      language: langId,
      voice: settings.voice,
      gender: settings.gender,
    })
  }
}

const browserProvider = new BrowserSpeechProvider()
const bhashiniProvider = new BhashiniSpeechProvider()

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function providerSettings(options = {}) {
  return {
    voice: options.voice || 'default',
    gender: options.gender || 'default',
  }
}

async function speakFromProviders(text, langId, options) {
  const settings = providerSettings(options)
  const hooks = options
  const { cacheKey, textHash } = await createAudioCacheKey(text, langId, settings.voice, settings.gender)
  const cached = await getCachedAudio(cacheKey)
  if (cached) return playCachedAudio(cached, hooks)

  if (isOnline() && bhashiniProvider.canSpeak(langId)) {
    try {
      const audioBlob = await bhashiniProvider.synthesize(text, langId, settings)
      await cacheAudio({ cacheKey, language: langId, textHash, audioBlob })
      const fresh = await getCachedAudio(cacheKey)
      if (fresh) return playCachedAudio(fresh, hooks)
    } catch {
      // A proxy or network failure falls through to the local provider.
    }
  }

  return browserProvider.speak(text, langId, hooks)
}

export const voiceEngine = {
  providers: { browser: browserProvider, bhashini: bhashiniProvider },
  speak(text, langId, hooks) {
    const language = LANGUAGE_REGISTRY[langId] || LANGUAGE_REGISTRY.en
    const options = hooks || {}
    let cancelled = false
    const operation = speakFromProviders(text, language.code, options).then((result) => {
      if (cancelled) result.cancel?.()
      return result
    }).catch((error) => {
      options.onError?.(error)
      options.onEnd?.()
      return { ok: false, reason: error.code || 'voice-error', cancel: () => {} }
    })
    return {
      ok: true,
      pending: true,
      fallback: false,
      cancel: () => {
        cancelled = true
        options.onEnd?.()
      },
      ready: operation,
    }
  },
  async getStatus(langId) {
    const [browser, cache] = await Promise.all([
      Promise.resolve(getVoiceStatus(langId)),
      getCachedAudioStatus(langId),
    ])
    return {
      browser,
      bhashini: bhashiniProvider.getStatus(langId),
      offlineCache: cache,
    }
  },
  warm() {
    browserProvider.warm()
  },
  getAvailableVoices,
  isVoiceAvailable,
  getVoiceStatus,
  subscribeToVoiceChanges,
}
