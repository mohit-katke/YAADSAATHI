import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function LanguageSwitcher() {
  const { t, tVoice, textLang, voiceLang, setTextLang, setVoiceLang, langs } = useI18n()
  const [open, setOpen] = useState(false)
  const [voiceStatuses, setVoiceStatuses] = useState({})
  const [voiceNote, setVoiceNote] = useState('')

  useEffect(() => {
    let cancelled = false
    const updateStatuses = async () => {
      const statuses = await getVoiceStatuses(langs)
      if (!cancelled) setVoiceStatuses(statuses)
    }
    updateStatuses()
    const unsubscribe = voiceEngine.subscribeToVoiceChanges(updateStatuses)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [langs])

  const selectedVoiceStatus = voiceStatuses[voiceLang] || {
    browser: voiceEngine.getVoiceStatus(voiceLang),
    bhashini: { status: 'not-configured', available: false },
    offlineCache: { available: false, count: 0 },
  }
  const canTestVoice = selectedVoiceStatus.browser.available || selectedVoiceStatus.bhashini.available || selectedVoiceStatus.offlineCache.available

  function testVoice() {
    const result = voiceEngine.speak(tVoice('voiceTest'), voiceLang, {
      onError: () => setVoiceNote(`${t('voiceUnavailableFriendly')} ${t('voiceTextOnly')}`),
    })
    setVoiceNote(result.ok ? t('voiceTestStarted') : `${t('voiceUnavailableFriendly')} ${t('voiceTextOnly')}`)
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <section
          role="dialog"
          aria-label={t('languageAndVoice')}
          className="mb-3 max-h-[calc(100svh-6rem)] w-[min(calc(100vw-2rem),26rem)] overflow-y-auto overscroll-contain rounded-3xl border-2 border-line bg-paper p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl font-extrabold">{t('languageAndVoice')}</p>
              <p className="mt-1 text-base text-muted">{t('preferredPair')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-12 min-w-12 rounded-xl border-2 border-line bg-cream px-3 text-xl font-extrabold"
              aria-label={t('close')}
            >
              ×
            </button>
          </div>

          <h2 className="mt-5 text-sm font-extrabold uppercase tracking-wide text-muted">{t('textLanguageSection')}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {langs.map((lang) => (
              <button
                key={`text-${lang.id}`}
                type="button"
                onClick={() => setTextLang(lang.id)}
                className={`min-h-12 rounded-xl px-2 text-sm font-extrabold ${
                  textLang === lang.id ? 'bg-green text-white' : 'border-2 border-line bg-cream'
                }`}
                aria-pressed={textLang === lang.id}
              >
                {lang.native}
              </button>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-muted">{t('voiceLanguageSection')}</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {langs.map((lang) => (
              <VoiceLanguageButton
                key={`voice-${lang.id}`}
                language={lang}
                status={voiceStatuses[lang.id]}
                selected={voiceLang === lang.id}
                onSelect={() => {
                  setVoiceLang(lang.id)
                  setVoiceNote('')
                }}
                availableLabel={t('available')}
                unavailableLabel={t('unavailable')}
                selectedLabel={t('selected')}
              />
            ))}
          </div>

          <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-muted">{t('voiceStatus')}</h2>
          <div className="mt-2 space-y-2 text-sm font-semibold" role="status">
            <StatusLine label={t('bhashiniVoice')} value={bhashiniStatusLabel(t, selectedVoiceStatus.bhashini)} />
            <StatusLine label={t('browserVoice')} value={selectedVoiceStatus.browser.available ? t('available') : t('unavailable')} />
            <StatusLine label={t('offlineCache')} value={selectedVoiceStatus.offlineCache.available ? t('available') : t('notCached')} />
          </div>
          {!canTestVoice ? <p className="mt-2 text-sm font-semibold text-muted">{t('voiceUnavailableFriendly')} {t('voiceTextOnly')}</p> : null}
          {canTestVoice ? (
            <button type="button" onClick={testVoice} className="mt-3 min-h-12 w-full rounded-xl bg-blue text-base font-extrabold text-white">
              {t('testVoice')}
            </button>
          ) : null}
          {voiceNote ? <p className="mt-2 text-sm font-bold text-muted">{voiceNote}</p> : null}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-12 w-full rounded-xl bg-ink text-base font-extrabold text-white"
          >
            {t('close')}
          </button>
        </section>
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

async function getVoiceStatuses(langs) {
  const entries = await Promise.all(langs.map(async (lang) => [lang.id, await voiceEngine.getStatus(lang.id)]))
  return Object.fromEntries(entries)
}

function VoiceLanguageButton({ language, status, selected, onSelect, availableLabel, unavailableLabel, selectedLabel }) {
  const isAvailable = status?.browser?.available
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-extrabold ${
        selected ? 'border-blue bg-blue text-white' : 'border-line bg-cream'
      }`}
      aria-pressed={selected}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{language.native}</span>
        <span aria-label={isAvailable ? availableLabel : unavailableLabel}>{isAvailable ? '✓' : '⚠'}</span>
      </span>
      <span className={`mt-1 block text-xs font-semibold ${selected ? 'text-white/85' : 'text-muted'}`}>
        {isAvailable ? availableLabel : unavailableLabel}{selected ? ` · ${selectedLabel}` : ''}
      </span>
    </button>
  )
}

function StatusLine({ label, value }) {
  return (
    <p className="flex items-start justify-between gap-3 rounded-xl bg-cream px-3 py-2">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </p>
  )
}

function bhashiniStatusLabel(t, status) {
  if (status?.status === 'available-online') return t('availableOnline')
  if (status?.status === 'unsupported-language') return t('unsupportedLanguage')
  return t('notConfigured')
}
