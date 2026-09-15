import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGS, LANGUAGE_REGISTRY, translate } from './strings'
import { getDeviceLanguage, saveDeviceLanguage, updateUserLanguages } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'

const I18nContext = createContext(null)

function supportedLanguage(value, fallback = 'en') {
  return LANGUAGE_REGISTRY[value]?.textSupported ? value : fallback
}

export function I18nProvider({ children }) {
  const { user } = useAuth()
  const [textLang, setTextLangState] = useState('en')
  const [voiceLang, setVoiceLangState] = useState('en')
  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const device = await getDeviceLanguage()
      if (user?.textLang) {
        if (!cancelled) {
          const nextText = supportedLanguage(user.textLang)
          setTextLangState(nextText)
          setVoiceLangState(supportedLanguage(user.voiceLang || nextText, nextText))
          setVoiceEnabledState(device.voiceEnabled !== false)
          setReady(true)
        }
        return
      }
      if (!cancelled) {
        const nextText = supportedLanguage(device.textLang)
        setTextLangState(nextText)
        setVoiceLangState(supportedLanguage(device.voiceLang, nextText))
        setVoiceEnabledState(device.voiceEnabled !== false)
        setReady(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const persist = useCallback(
    async (nextText, nextVoice) => {
      await saveDeviceLanguage(nextText, nextVoice, voiceEnabled)
      if (user?.id) await updateUserLanguages(user.id, nextText, nextVoice)
    },
    [user, voiceEnabled],
  )

  const setTextLang = useCallback(
    (lang) => {
      setTextLangState(lang)
      persist(lang, voiceLang)
    },
    [persist, voiceLang],
  )

  const setVoiceLang = useCallback(
    (lang) => {
      setVoiceLangState(lang)
      persist(textLang, lang)
    },
    [persist, textLang],
  )

  const setVoiceEnabled = useCallback(
    (enabled) => {
      setVoiceEnabledState(Boolean(enabled))
      saveDeviceLanguage(textLang, voiceLang, Boolean(enabled))
    },
    [textLang, voiceLang],
  )

  const swapPreferred = useCallback(() => {
    if (textLang === voiceLang) return
    setTextLangState(voiceLang)
    setVoiceLangState(textLang)
    persist(voiceLang, textLang)
  }, [persist, textLang, voiceLang])

  const value = useMemo(
    () => ({
      ready,
      textLang,
      voiceLang,
      voiceEnabled,
      setTextLang,
      setVoiceLang,
      setVoiceEnabled,
      swapPreferred,
      langs: LANGS,
      t: (key, vars) => translate(textLang, key, vars),
      tVoice: (key, vars) => translate(voiceLang, key, vars),
    }),
    [ready, setTextLang, setVoiceLang, setVoiceEnabled, swapPreferred, textLang, voiceEnabled, voiceLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
