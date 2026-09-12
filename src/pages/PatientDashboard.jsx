import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import OfflineBanner from '../components/OfflineBanner'
import { PATIENT, TODAY_ACTIVITY, PATIENT_PROGRESS } from '../data/mock'
import { getLinkedPatient, listGameScores, getReminders } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [patient, setPatient] = useState(null)
  const [reminders, setReminders] = useState([])
  const [scores, setScores] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const linked = await getLinkedPatient(user)
      const userId = linked?.id || user.id
      const [rems, games] = await Promise.all([getReminders(userId), listGameScores(userId)])
      if (cancelled) return
      setPatient(linked || user)
      setReminders(rems)
      setScores(games)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const latest = scores[0]
  const name = patient?.fullName || user?.fullName || PATIENT.name
  const progressPct = useMemo(() => {
    const done = PATIENT_PROGRESS.routineDone + (scores.length ? 1 : 0)
    return Math.min(100, Math.round((done / (PATIENT_PROGRESS.routineTotal + 1)) * 100))
  }, [scores.length])

  function go(path, promptKey) {
    voiceEngine.speak(tVoice(promptKey), voiceLang)
    navigate(path)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar showHome={false} showExit />
      <p className="text-3xl font-extrabold text-ink sm:text-4xl">{t('namaste')}</p>
      <p className="mt-1 text-xl font-semibold text-muted">{name}</p>

      <div className="mt-5">
        <OfflineBanner />
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('activities')}</h2>
        <p className="mt-1 text-lg text-muted">{TODAY_ACTIVITY.time}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ['/patient/game', '🧩', t('memoryMatch'), t('findMatchingPairs')],
            ['/patient/recognize/people', '👨‍👩‍👧', t('whoIsThis'), t('recognizeFamiliarPeople')],
            ['/patient/recognize/places', '🏠', t('familiarPlaces'), t('recognizeRoutinePlaces')],
            ['/patient/recognize/objects', '☕', t('everydayObjects'), t('recognizeUsefulObjects')],
            ['/patient/story', '📖', t('storyRecall'), t('storyHint')],
            ['/patient/routine', '☀️', t('dailyRoutine'), t('simpleSteps')],
          ].map(([path, icon, title, description]) => (
            <button key={path} type="button" onClick={() => navigate(path)} className="rounded-2xl border-2 border-line bg-cream p-4 text-left">
              <span className="text-4xl" aria-hidden="true">{icon}</span>
              <p className="mt-2 text-xl font-extrabold">{title}</p>
              <p className="mt-1 text-base text-muted">{description}</p>
              <span className="mt-3 inline-block rounded-xl bg-orange px-4 py-2 text-base font-extrabold text-white">{t('start')}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-3">
        <button type="button" onClick={() => go('/patient/voice', 'voiceReminder')} className="min-h-16 rounded-3xl bg-blue text-2xl font-extrabold text-white">
          {t('voiceAssist')}
        </button>
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('progress')}</h2>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-green" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-3 text-lg font-bold text-muted">
          {t('games')}: {scores.length || PATIENT_PROGRESS.gamesToday} · {t('lastScore')}: {latest?.score || 0}
        </p>
      </section>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('sessionSummary')}</h2>
        {latest ? (
          <p className="mt-2 text-lg font-semibold">
            {t('accuracy')}: {latest.accuracy}% · {t('reaction')}: {latest.avgReactionMs} ms · {t('difficulty')}: {latest.difficulty}
          </p>
        ) : (
          <p className="mt-2 text-lg text-muted">{t('memoryMatch')}</p>
        )}
      </section>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('reminders')}</h2>
        <ul className="mt-3 space-y-3">
          {reminders.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
              <div>
                <p className="text-lg font-extrabold">{item.text}</p>
                <p className="text-base text-muted">{item.time}</p>
              </div>
              <span className={`text-lg font-extrabold ${item.done ? 'text-green-dark' : 'text-orange-dark'}`}>
                {item.done ? t('done') : t('soon')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
