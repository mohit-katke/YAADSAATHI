import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import OfflineBanner from '../components/OfflineBanner'
import Toast from '../components/Toast'
import { BarChart } from '../components/SimpleChart'
import { PATIENT, CAREGIVER_STATS, ACTIVITY_TREND } from '../data/mock'
import {
  addReminder,
  getDoctorAuthorized,
  getLinkedPatient,
  getReminders,
  listCognitiveSessions,
  listGameScores,
  listFamiliarPeople,
  listFamiliarPlaces,
  saveDoctorAuthorized,
  saveFamiliarPerson,
  saveFamiliarPlace,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'

export default function CaregiverDashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [toast, setToast] = useState('')
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('7:00 PM')
  const [text, setText] = useState('Evening tea')
  const [patient, setPatient] = useState(null)
  const [reminders, setReminders] = useState([])
  const [scores, setScores] = useState([])
  const [sessions, setSessions] = useState([])
  const [authorized, setAuthorized] = useState(true)
  const [people, setPeople] = useState([])
  const [places, setPlaces] = useState([])
  const [familiarForm, setFamiliarForm] = useState(null)

  async function reload(userId) {
    const [rems, games, history, authz, familiarPeople, familiarPlaces] = await Promise.all([
      getReminders(userId),
      listGameScores(userId),
      listCognitiveSessions(userId),
      getDoctorAuthorized(userId),
      listFamiliarPeople(userId),
      listFamiliarPlaces(userId),
    ])
    setReminders(rems)
    setScores(games)
    setSessions(history)
    setAuthorized(authz)
    setPeople(familiarPeople)
    setPlaces(familiarPlaces)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const linked = await getLinkedPatient(user)
      if (cancelled || !linked) return
      setPatient(linked)
      await reload(linked.id)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const patientId = patient?.id
  const latest = scores[0]
  const avgReaction =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, row) => sum + (row.avgReactionMs || 0), 0) / sessions.length)
      : CAREGIVER_STATS.avgReactionMs
  const trend =
    sessions.length > 0
      ? sessions
          .slice(0, 7)
          .reverse()
          .map((row) => ({ day: row.dateLabel || 'Day', value: row.score || 1 }))
      : ACTIVITY_TREND

  async function addReminderForm(event) {
    event.preventDefault()
    if (!patientId) return
    await addReminder(patientId, { time: time.trim() || 'Soon', text: text.trim() || 'Reminder' })
    await reload(patientId)
    setOpen(false)
    setToast(t('reminderSaved'))
  }

  async function saveFamiliar(event) {
    event.preventDefault()
    if (!patientId || !familiarForm?.name.trim()) return
    if (familiarForm.kind === 'person') {
      await saveFamiliarPerson(patientId, { name: familiarForm.name.trim(), relationship: familiarForm.detail.trim(), emoji: '👤' })
    } else {
      await saveFamiliarPlace(patientId, { name: familiarForm.name.trim(), description: familiarForm.detail.trim(), emoji: '📍' })
    }
    await reload(patientId)
    setFamiliarForm(null)
    setToast('Saved on this device.')
  }

  async function shareReport() {
    const report = `YaadSaathi activity report for ${patient?.fullName || PATIENT.name}\nSessions: ${sessions.length}\nAverage reaction: ${avgReaction} ms`
    if (navigator.share) {
      await navigator.share({ title: 'YaadSaathi activity report', text: report })
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(report)
      setToast('Report copied to the clipboard.')
    } else {
      setToast(report)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 pb-28">
      <TopBar showHome={false} showExit />
      <h1 className="text-3xl font-extrabold">{t('caregiver')}</h1>
      <p className="mt-1 text-xl text-muted">{t('lookingAfter', { name: patient?.fullName || PATIENT.name })}</p>
      <div className="mt-4">
        <OfflineBanner />
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('patient')}</h2>
        <p className="mt-2 text-2xl font-extrabold">{patient?.fullName || PATIENT.name}</p>
        <p className="text-lg text-muted">
          {patient?.age || PATIENT.age} · {patient?.location || PATIENT.place}
        </p>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat label={t('todaysActivity')} value={CAREGIVER_STATS.activityStatus} />
        <Stat label={t('gameSessions')} value={`${Math.max(sessions.length, scores.length)} ${t('completed')}`} />
        <Stat label={t('avgReaction')} value={`${avgReaction} ms`} />
        <Stat label={t('reminders')} value={`${reminders.filter((r) => r.done).length} / ${reminders.length}`} />
      </div>

      {latest ? (
        <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
          <h2 className="text-xl font-extrabold">{t('lastScore')}</h2>
          <p className="mt-2 text-lg font-bold">
            {t('score')}: {latest.score} · {t('accuracy')}: {latest.accuracy}% · {t('reaction')}: {latest.avgReactionMs} ms
          </p>
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Patient Activity</h2>
        <div className="mt-3 space-y-2">
          {['Memory Match', 'Who Is This?', 'Familiar Places', 'Everyday Objects', 'Story Recall', 'Daily Routine'].map((activity) => {
            const session = sessions.find((row) => row.game === activity)
            return (
              <div key={activity} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
                <span className="font-bold">{activity}</span>
                <span className="text-right text-sm font-bold text-muted">{session ? `Completed · ${session.accuracy}%` : 'Not completed'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Familiar People & Places</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">People</p>
            <p className="mt-1 text-muted">{people.map((person) => person.name).join(', ') || 'No people added yet'}</p>
            <button type="button" onClick={() => setFamiliarForm({ kind: 'person', name: '', detail: '' })} className="mt-3 min-h-12 rounded-xl bg-green px-4 text-base font-extrabold text-white">Add Familiar Person</button>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">Places</p>
            <p className="mt-1 text-muted">{places.map((place) => place.name).join(', ') || 'No places added yet'}</p>
            <button type="button" onClick={() => setFamiliarForm({ kind: 'place', name: '', detail: '' })} className="mt-3 min-h-12 rounded-xl bg-blue px-4 text-base font-extrabold text-white">Add Familiar Place</button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <BarChart data={trend} label={t('activityWeek')} />
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('authorizeDoctor')}</h2>
        <p className="mt-2 text-lg font-bold">{authorized ? t('authorized') : t('notAuthorized')}</p>
        <button
          type="button"
          onClick={async () => {
            if (!patientId) return
            await saveDoctorAuthorized(patientId, !authorized)
            setAuthorized(!authorized)
            setToast(t('doctorAuthorizedToast'))
          }}
          className="mt-3 min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white"
        >
          {t('authorizeDoctor')}
        </button>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={shareReport}
          className="min-h-14 rounded-2xl bg-blue text-xl font-extrabold text-white"
        >
          {t('shareReport')}
        </button>
        <button type="button" onClick={() => setOpen(true)} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">
          {t('setReminder')}
        </button>
      </div>

      {open ? (
        <form onSubmit={addReminderForm} className="mt-5 rounded-3xl border-2 border-orange bg-paper p-5">
          <h2 className="text-xl font-extrabold">{t('newReminder')}</h2>
          <label className="mt-3 block text-lg font-bold" htmlFor="rem-time">
            {t('time')}
          </label>
          <input
            id="rem-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <label className="mt-3 block text-lg font-bold" htmlFor="rem-text">
            {t('note')}
          </label>
          <input
            id="rem-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="submit" className="min-h-14 rounded-2xl bg-green text-lg font-extrabold text-white">
              {t('save')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-14 rounded-2xl border-2 border-line text-lg font-extrabold">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {familiarForm ? (
        <form onSubmit={saveFamiliar} className="mt-5 rounded-3xl border-2 border-blue bg-paper p-5">
          <h2 className="text-xl font-extrabold">{familiarForm.kind === 'person' ? 'Add Familiar Person' : 'Add Familiar Place'}</h2>
          <input
            required
            autoFocus
            value={familiarForm.name}
            onChange={(event) => setFamiliarForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={familiarForm.kind === 'person' ? 'Name' : 'Place name'}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <input
            value={familiarForm.detail}
            onChange={(event) => setFamiliarForm((current) => ({ ...current, detail: event.target.value }))}
            placeholder={familiarForm.kind === 'person' ? 'Relationship' : 'Description'}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="submit" className="min-h-14 rounded-2xl bg-green text-lg font-extrabold text-white">{t('save')}</button>
            <button type="button" onClick={() => setFamiliarForm(null)} className="min-h-14 rounded-2xl border-2 border-line text-lg font-extrabold">{t('cancel')}</button>
          </div>
        </form>
      ) : null}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <p className="text-base font-bold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </div>
  )
}
