import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function LanguageSwitcher() {
  const { t, tVoice, textLang, voiceLang, voiceEnabled, setTextLang, setVoiceLang, setVoiceEnabled, swapPreferred, langs } = useI18n()
  const [open, setOpen] = useState(false)
  const [voiceReady, setVoiceReady] = useState(() => voiceEngine.isVoiceAvailable(voiceLang))
  const [voiceNote, setVoiceNote] = useState('')

  useEffect(() => {
    setVoiceReady(voiceEngine.isVoiceAvailable(voiceLang))
    return voiceEngine.subscribeToVoiceChanges(() => setVoiceReady(voiceEngine.isVoiceAvailable(voiceLang)))
  }, [voiceLang])

  function testVoice() {
    if (!voiceEnabled) return
    const result = voiceEngine.speak(tVoice('voiceTest'), voiceLang)
    setVoiceNote(result.fallback ? t('voiceUnavailableFriendly') : t('voiceTestStarted'))
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open ? (
        <div className="mb-3 w-[min(92vw,22rem)] rounded-3xl border-2 border-line bg-paper p-4 shadow-lg">
          <p className="text-lg font-extrabold">{t('langButton')}</p>
          <p className="mt-1 text-base text-muted">{t('preferredPair')}</p>

          <p className="mt-4 text-base font-bold">{t('changeText')}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {langs.map((lang) => (
              <button
                key={`text-${lang.id}`}
                type="button"
                onClick={() => setTextLang(lang.id)}
                className={`min-h-12 rounded-xl px-2 text-sm font-extrabold ${
                  textLang === lang.id ? 'bg-green text-white' : 'border-2 border-line bg-cream'
                }`}
              >
                {lang.native}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold text-muted">
            {voiceReady ? t('voiceAvailable') : t('voiceUnavailableFriendly')}
          </p>
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`mt-3 min-h-12 w-full rounded-xl text-base font-extrabold text-white ${voiceEnabled ? 'bg-green' : 'bg-ink'}`}
            aria-pressed={voiceEnabled}
          >
            Voice Assistant: {voiceEnabled ? 'On' : 'Off'}
          </button>
          <button type="button" onClick={testVoice} disabled={!voiceEnabled} className="mt-2 min-h-12 w-full rounded-xl bg-blue text-base font-extrabold text-white disabled:opacity-50">
            {t('testVoice')}
          </button>
          {voiceNote ? <p className="mt-2 text-sm font-bold text-muted">{voiceNote}</p> : null}

          <p className="mt-4 text-base font-bold">{t('changeVoice')}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {langs.map((lang) => (
              <button
                key={`voice-${lang.id}`}
                type="button"
                onClick={() => setVoiceLang(lang.id)}
                className={`min-h-12 rounded-xl px-2 text-sm font-extrabold ${
                  voiceLang === lang.id ? 'bg-blue text-white' : 'border-2 border-line bg-cream'
                }`}
              >
                {lang.native}
              </button>
            ))}
          </div>

          {textLang !== voiceLang ? (
            <button
              type="button"
              onClick={swapPreferred}
              className="mt-4 min-h-12 w-full rounded-xl border-2 border-orange text-base font-extrabold text-orange-dark"
            >
              {langs.find((l) => l.id === textLang)?.native} ↔ {langs.find((l) => l.id === voiceLang)?.native}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-12 w-full rounded-xl bg-ink text-base font-extrabold text-white"
          >
            {t('close')}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 min-w-14 items-center gap-2 rounded-2xl bg-green px-4 text-lg font-extrabold text-white shadow-lg"
        aria-expanded={open}
      >
        文A
        <span>{t('langButton')}</span>
      </button>
    </div>
  )
}
