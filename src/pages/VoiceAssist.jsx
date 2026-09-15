import { useState } from 'react'
import TopBar from '../components/TopBar'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function VoiceAssist() {
  const { t, tVoice, voiceLang, voiceEnabled } = useI18n()
  const [line, setLine] = useState(() => tVoice('promptWalk'))
  const [speaking, setSpeaking] = useState(false)
  const [note, setNote] = useState('')

  const keys = ['promptWalk', 'promptWater', 'promptGame', 'promptFamily']

  function speak() {
    if (!voiceEnabled) {
      setNote('Voice Assistant is off. Turn it on from Language settings.')
      return
    }
    const key = keys[Math.floor(Math.random() * keys.length)]
    const next = tVoice(key)
    setLine(next)
    const result = voiceEngine.speak(next, voiceLang, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setNote(t('voiceUnavailableFriendly')),
    })
    setNote(result.fallback ? t('voiceUnavailableFriendly') : '')
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('voiceAssist')}</h1>
      <p className="mt-2 text-lg text-muted">{t('voiceDemo')}</p>
      {note ? <p className="mt-3 text-base font-bold text-orange-dark">{note}</p> : null}
      <div className="mt-8 flex flex-col items-center rounded-3xl border border-line bg-paper p-8">
        <button
          type="button"
          onClick={speak}
          className={`flex h-36 w-36 items-center justify-center rounded-full text-5xl text-white ${
            speaking ? 'bg-orange' : 'bg-blue'
          }`}
          aria-label={t('tapMic')}
        >
          🎤
        </button>
        <p className="mt-6 text-center text-2xl font-extrabold leading-snug">{line}</p>
        <p className="mt-4 text-lg font-bold text-muted">{speaking ? t('speaking') : t('tapMic')}</p>
        {note ? <p className="mt-3 text-center text-base font-bold text-orange-dark">{note}</p> : null}
      </div>
    </div>
  )
}
