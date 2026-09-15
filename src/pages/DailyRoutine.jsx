import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { normalizeDifficultyLevel } from '../data/mock'
import { getCurrentDifficulty, getLinkedPatient, listDailyTasks, completeDailyTask, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function DailyRoutine() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [patientId, setPatientId] = useState(user?.id)
  const [level, setLevel] = useState('Level 1')
  const [items, setItems] = useState([])
  const done = items.filter((i) => i.completed).length

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const userId = patient?.id || user.id
      const currentLevel = normalizeDifficultyLevel(await getCurrentDifficulty(userId), 'Level 1')
      const tasks = await listDailyTasks(userId, new Date().toISOString().slice(0, 10))
      if (cancelled) return
      setPatientId(userId)
      setLevel(currentLevel)
      setItems(tasks)
    }
    load()
    voiceEngine.speak(tVoice('voiceRoutine'), voiceLang)
    return () => {
      cancelled = true
    }
  }, [user, tVoice, voiceLang])

  useEffect(() => {
  }, [level, patientId])

  async function toggle(id) {
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    const next = items.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry))
    setItems(next)
    await completeDailyTask(id, patientId, !item.completed)
    if (next.length > 0 && next.every((entry) => entry.completed)) {
      await saveActivitySession({
        userId: patientId,
        gameType: 'daily-routine',
        game: 'Daily Routine',
        score: next.length * 10,
        accuracy: 100,
        reactionLatency: 0,
        difficulty: level,
        details: { items: next, level },
      })
    }
  }

  async function retry() {
    setItems([])
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('dailyRoutine')}</h1>
      <p className="mt-2 text-base font-extrabold text-blue-dark">{t('difficultyLabel')}: {t(level.toLowerCase().replace(' ', ''))}</p>
      <p className="mt-2 text-xl font-bold text-muted">{t('doneOf', { done, total: items.length })}</p>
      {!items.length ? <p className="mt-5 rounded-2xl bg-paper p-5 text-lg font-semibold text-muted">No daily tasks have been assigned yet.</p> : null}
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={`flex min-h-16 w-full items-center gap-4 rounded-3xl border-2 px-4 text-left text-xl font-extrabold ${
                item.completed ? 'border-green bg-green/10 text-green-dark' : 'border-line bg-paper text-ink'
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current">
                {item.completed ? '✓' : ''}
              </span>
              {item.title}
            </button>
          </li>
        ))}
      </ul>
      {done === items.length && items.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={retry} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">
            {t('playAgain')}
          </button>
          <button type="button" onClick={() => navigate('/patient')} className="min-h-14 rounded-2xl border-2 border-line text-xl font-extrabold">
            {t('backDashboard')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
