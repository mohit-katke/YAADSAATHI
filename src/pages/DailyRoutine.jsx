import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import { DEFAULT_ROUTINE } from '../data/mock'
import { getLinkedPatient, getRoutine, saveActivitySession, saveRoutine } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function DailyRoutine() {
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [patientId, setPatientId] = useState(user?.id)
  const [items, setItems] = useState(DEFAULT_ROUTINE)
  const done = items.filter((i) => i.done).length

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const userId = patient?.id || user.id
      const routine = await getRoutine(userId)
      if (cancelled) return
      setPatientId(userId)
      setItems(routine)
    }
    load()
    voiceEngine.speak(tVoice('voiceRoutine'), voiceLang)
    return () => {
      cancelled = true
    }
  }, [user, tVoice, voiceLang])

  async function toggle(id) {
    const next = items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    setItems(next)
    await saveRoutine(patientId, next)
    if (next.every((item) => item.done)) {
      await saveActivitySession({
        userId: patientId,
        gameType: 'daily-routine',
        game: 'Daily Routine',
        score: next.length * 10,
        accuracy: 100,
        reactionLatency: 0,
        difficulty: 'Easy',
        details: { items: next },
      })
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('dailyRoutine')}</h1>
      <p className="mt-2 text-xl font-bold text-muted">{t('doneOf', { done, total: items.length })}</p>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={`flex min-h-16 w-full items-center gap-4 rounded-3xl border-2 px-4 text-left text-xl font-extrabold ${
                item.done ? 'border-green bg-green/10 text-green-dark' : 'border-line bg-paper text-ink'
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current">
                {item.done ? '✓' : ''}
              </span>
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
