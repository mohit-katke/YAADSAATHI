import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import OfflineBanner from '../components/OfflineBanner'
import Toast from '../components/Toast'
import { LineChart } from '../components/SimpleChart'
import { PATIENT, DOCTOR_OVERVIEW, LATENCY_TREND, LEVEL_ORDER } from '../data/mock'
import {
  addTelemetry,
  getDifficultyCap,
  getDoctorAuthorized,
  getLinkedPatient,
  listCognitiveSessions,
  saveDifficultyCap,
  saveSettings,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [cap, setCap] = useState('Medium')
  const [toast, setToast] = useState('')
  const [patient, setPatient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [authorized, setAuthorized] = useState(true)
  const [feedback, setFeedback] = useState('feedbackKeep')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const linked = await getLinkedPatient(user)
      if (cancelled || !linked) return
      const [history, capLevel, authz] = await Promise.all([
        listCognitiveSessions(linked.id),
        getDifficultyCap(linked.id),
        getDoctorAuthorized(linked.id),
      ])
      setPatient(linked)
      setSessions(history)
      setCap(capLevel)
      setAuthorized(authz)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const latest = sessions[0]
  const avgLatency =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, row) => sum + (row.avgReactionMs || 0), 0) / sessions.length)
      : DOCTOR_OVERVIEW.avgLatencyMs
  const avgAccuracy =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, row) => sum + (row.accuracy || 0), 0) / sessions.length)
      : DOCTOR_OVERVIEW.accuracy
  const latencyData =
    sessions.length > 0
      ? sessions
          .slice(0, 7)
          .reverse()
          .map((row) => ({ day: row.dateLabel || '', ms: row.avgReactionMs || 0 }))
      : LATENCY_TREND

  async function applyCap(level) {
    if (!patient) return
    setCap(level)
    await saveDifficultyCap(patient.id, level)
    setToast(`${t('currentCap')}: ${level}`)
  }

  async function saveFeedback() {
    if (!patient) return
    await saveSettings(patient.id, { doctorFeedback: feedback })
    await addTelemetry({ userId: patient.id, kind: 'doctor_feedback', data: { feedback } })
    setToast(t('feedbackSaved'))
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 pb-28">
      <TopBar showHome={false} showExit />
      <h1 className="text-3xl font-extrabold">{t('doctor')}</h1>
      <p className="mt-1 text-xl text-muted">{patient?.specialization || user?.specialization || 'Geriatric care'}</p>
      <div className="mt-4">
        <OfflineBanner />
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('patientOverview')}</h2>
        <p className="mt-2 text-2xl font-extrabold">{patient?.fullName || PATIENT.name}</p>
        <p className="text-lg text-muted">
          {patient?.age || PATIENT.age} · {patient?.location || PATIENT.place} · {t('caregiver')}: {PATIENT.caregiver}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric label={t('accuracy')} value={`${latest?.accuracy ?? avgAccuracy}%`} />
          <Metric label={t('avgReaction')} value={`${avgLatency} ms`} />
          <Metric label={t('difficulty')} value={latest?.difficulty || DOCTOR_OVERVIEW.difficulty} />
          <Metric label={t('gameSessions')} value={String(sessions.length || DOCTOR_OVERVIEW.sessionsThisWeek)} />
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <p className="text-lg font-extrabold">{t('caregiverAuth')}</p>
        <p className="mt-2 text-xl font-bold">{authorized ? t('authorized') : t('notAuthorized')}</p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Activity breakdown</h2>
        <p className="mt-1 text-sm font-semibold text-muted">Prototype engagement metrics, not diagnostic results.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ['Memory Match', '82%'],
            ['Familiar People', '76%'],
            ['Familiar Places', '88%'],
            ['Everyday Objects', '91%'],
            ['Story Recall', '79%'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-xl bg-cream px-4 py-3 text-lg font-bold">
              <span>{label}</span><span className="text-green-dark">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <LineChart data={latencyData} label={t('latencyTrend')} />
      </section>

      <section className="mt-4 overflow-x-auto rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('sessionHistory')}</h2>
        <table className="mt-3 w-full min-w-[520px] text-left text-lg">
          <thead>
            <tr className="border-b-2 border-line text-muted">
              <th className="py-3 pr-3 font-bold">{t('date')}</th>
              <th className="py-3 pr-3 font-bold">{t('session')}</th>
              <th className="py-3 pr-3 font-bold">{t('accuracy')}</th>
              <th className="py-3 pr-3 font-bold">{t('latency')}</th>
              <th className="py-3 font-bold">{t('level')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => (
              <tr key={row.id} className="border-b border-line">
                <td className="py-3 pr-3 font-extrabold">{row.dateLabel}</td>
                <td className="py-3 pr-3">{row.game}</td>
                <td className="py-3 pr-3">{row.accuracy}%</td>
                <td className="py-3 pr-3">{row.avgReactionMs} ms</td>
                <td className="py-3">{row.difficulty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('difficultyCap')}</h2>
        <p className="mt-1 text-lg text-muted">
          {t('lookingAfter', { name: patient?.fullName || PATIENT.name })}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {LEVEL_ORDER.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => applyCap(level)}
              className={`min-h-14 rounded-2xl text-xl font-extrabold ${
                cap === level ? 'bg-green text-white' : 'border-2 border-line bg-cream text-ink'
              }`}
            >
              {t(level.toLowerCase())}
            </button>
          ))}
        </div>
        <p className="mt-3 text-lg font-bold">
          {t('currentCap')}: {cap}
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('parameterFeedback')}</h2>
        <div className="mt-3 grid gap-3">
          {['feedbackKeep', 'feedbackRest', 'feedbackPraise'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFeedback(key)}
              className={`min-h-14 rounded-2xl text-lg font-extrabold ${
                feedback === key ? 'bg-blue text-white' : 'border-2 border-line bg-cream'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <button type="button" onClick={saveFeedback} className="mt-4 min-h-14 w-full rounded-2xl bg-orange text-xl font-extrabold text-white">
          {t('sendFeedback')}
        </button>
      </section>

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-cream p-4">
      <p className="text-base font-bold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  )
}
