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
  listFamiliarPeople,
  listFamiliarPlaces,
  listFamiliarThings,
  listGameScores,
  saveDoctorAuthorized,
  saveFamiliarPerson,
  saveFamiliarPlace,
  saveFamiliarThing,
  saveRecognitionItem,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import RecognitionContentManager from '../components/RecognitionContentManager'

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
  const [things, setThings] = useState([])
  const [familiarForm, setFamiliarForm] = useState(null)
  const [imageError, setImageError] = useState('')
  const [recognitionForm, setRecognitionForm] = useState(null)

  async function reload(userId) {
    const [rems, games, history, authz, familiarPeople, familiarPlaces, familiarThings] = await Promise.all([
      getReminders(userId),
      listGameScores(userId),
      listCognitiveSessions(userId),
      getDoctorAuthorized(userId),
      listFamiliarPeople(userId),
      listFamiliarPlaces(userId),
      listFamiliarThings(userId),
    ])
    setReminders(rems)
    setScores(games)
    setSessions(history)
    setAuthorized(authz)
    setPeople(familiarPeople)
    setPlaces(familiarPlaces)
    setThings(familiarThings)
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
      await saveFamiliarPerson(patientId, { name: familiarForm.name.trim(), relationship: familiarForm.detail.trim(), emoji: '👤', imageDataUrl: familiarForm.imageDataUrl || '' })
    } else if (familiarForm.kind === 'place') {
      await saveFamiliarPlace(patientId, { name: familiarForm.name.trim(), description: familiarForm.detail.trim(), emoji: '📍', imageDataUrl: familiarForm.imageDataUrl || '' })
    } else {
      await saveFamiliarThing(patientId, { name: familiarForm.name.trim(), description: familiarForm.detail.trim(), emoji: '🧩', imageDataUrl: familiarForm.imageDataUrl || '' })
    }
    await reload(patientId)
    setFamiliarForm(null)
    setImageError('')
    setToast('Saved on this device.')
  }

  async function saveRecognitionContent(event) {
    event.preventDefault()
    if (!patientId || !recognitionForm?.question?.trim()) return
    const options = [
      recognitionForm.option1,
      recognitionForm.option2,
      recognitionForm.option3,
      recognitionForm.option4,
    ].map((value) => String(value || '').trim()).filter(Boolean)
    if (options.length !== 4) {
      setImageError('Please provide exactly four answer options.')
      return
    }
    if (!recognitionForm.correctAnswer || !options.includes(recognitionForm.correctAnswer)) {
      setImageError('Please choose the correct answer from the four options.')
      return
    }
    await saveRecognitionItem({
      patientId,
      category: recognitionForm.category,
      kind: recognitionForm.category,
      question: recognitionForm.question.trim(),
      options,
      correctAnswer: recognitionForm.correctAnswer,
      difficulty: recognitionForm.difficulty || 'Level 1',
      imageDataUrl: recognitionForm.imageDataUrl || '',
      imageName: recognitionForm.imageName || 'recognition-item',
      imageMime: recognitionForm.imageMime || 'image/png',
      createdByRole: 'caregiver',
    })
    await reload(patientId)
    setRecognitionForm(null)
    setImageError('')
    setToast('Recognition question saved on this device.')
  }

  async function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setImageError('Please choose an image file only.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Image must be smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFamiliarForm((current) => ({ ...current, imageDataUrl: reader.result }))
      setImageError('')
    }
    reader.onerror = () => { setImageError('Image could not be loaded. Please choose another file.') }
    reader.readAsDataURL(file)
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

      <RecognitionContentManager patientId={patient?.id} role="caregiver" />

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Familiar People & Places</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">People</p>
            <p className="mt-1 text-muted">{people.map((person) => person.name).join(', ') || 'No people added yet'}</p>
            <button type="button" onClick={() => setFamiliarForm({ kind: 'person', name: '', detail: '', imageDataUrl: '' })} className="mt-3 min-h-12 rounded-xl bg-green px-4 text-base font-extrabold text-white">Add Familiar Person</button>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">Places</p>
            <p className="mt-1 text-muted">{places.map((place) => place.name).join(', ') || 'No places added yet'}</p>
            <button type="button" onClick={() => setFamiliarForm({ kind: 'place', name: '', detail: '', imageDataUrl: '' })} className="mt-3 min-h-12 rounded-xl bg-blue px-4 text-base font-extrabold text-white">Add Familiar Place</button>
          </div>
          <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
            <p className="text-lg font-extrabold">Things</p>
            <p className="mt-1 text-muted">{things.map((thing) => thing.name).join(', ') || 'No things added yet'}</p>
            <button type="button" onClick={() => setFamiliarForm({ kind: 'thing', name: '', detail: '', imageDataUrl: '' })} className="mt-3 min-h-12 rounded-xl bg-orange px-4 text-base font-extrabold text-white">Add Familiar Thing</button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setRecognitionForm({ category: 'place', question: '', option1: '', option2: '', option3: '', option4: '', correctAnswer: '', difficulty: 'Level 1', imageDataUrl: '', imageName: '', imageMime: '' })} className="min-h-12 rounded-xl bg-blue px-4 text-base font-extrabold text-white">Add recognition question</button>
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
          <h2 className="text-xl font-extrabold">{familiarForm.kind === 'person' ? 'Add Familiar Person' : familiarForm.kind === 'place' ? 'Add Familiar Place' : 'Add Familiar Thing'}</h2>
          <input
            required
            autoFocus
            value={familiarForm.name}
            onChange={(event) => setFamiliarForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={familiarForm.kind === 'person' ? 'Name' : familiarForm.kind === 'place' ? 'Place name' : 'Thing name'}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <input
            value={familiarForm.detail}
            onChange={(event) => setFamiliarForm((current) => ({ ...current, detail: event.target.value }))}
            placeholder={familiarForm.kind === 'person' ? 'Relationship' : 'Description'}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <label className="mt-3 block text-lg font-bold text-ink">
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => addImageFile(event.target.files?.[0])}
              className="mt-2 block w-full rounded-2xl border-2 border-dashed border-line bg-cream p-3 text-base"
            />
          </label>
          {familiarForm.imageDataUrl ? (
            <div className="mt-3 rounded-2xl border border-line bg-cream p-3">
              <img src={familiarForm.imageDataUrl} alt="Preview" className="mx-auto h-36 w-full rounded-xl object-contain" />
            </div>
          ) : null}
          {imageError ? <p className="mt-2 text-base font-bold text-orange-dark">{imageError}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="submit" className="min-h-14 rounded-2xl bg-green text-lg font-extrabold text-white">{t('save')}</button>
            <button type="button" onClick={() => { setFamiliarForm(null); setImageError('') }} className="min-h-14 rounded-2xl border-2 border-line text-lg font-extrabold">{t('cancel')}</button>
          </div>
        </form>
      ) : null}

      {recognitionForm ? (
        <form onSubmit={saveRecognitionContent} className="mt-5 rounded-3xl border-2 border-blue bg-paper p-5">
          <h2 className="text-xl font-extrabold">Add recognition question</h2>
          <label className="mt-3 block text-lg font-bold">
            Category
            <select value={recognitionForm.category} onChange={(event) => setRecognitionForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              <option value="person">Person</option>
              <option value="place">Place</option>
              <option value="thing">Thing</option>
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold">
            Question
            <input value={recognitionForm.question} onChange={(event) => setRecognitionForm((current) => ({ ...current, question: event.target.value }))} placeholder="What place is this?" className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
          </label>
          <label className="mt-3 block text-lg font-bold">
            Upload image
            <input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                setRecognitionForm((current) => ({ ...current, imageDataUrl: String(reader.result || ''), imageName: file.name, imageMime: file.type }))
                setImageError('')
              }
              reader.onerror = () => setImageError('Image could not be loaded.')
              reader.readAsDataURL(file)
            }} className="mt-2 block w-full rounded-2xl border-2 border-dashed border-line bg-cream p-3 text-base" />
          </label>
          {recognitionForm.imageDataUrl ? (
            <div className="mt-3 rounded-2xl border border-line bg-cream p-3">
              <img src={recognitionForm.imageDataUrl} alt="Preview" className="mx-auto h-36 w-full rounded-xl object-contain" />
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={recognitionForm.option1} onChange={(event) => setRecognitionForm((current) => ({ ...current, option1: event.target.value }))} placeholder="Answer option 1" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={recognitionForm.option2} onChange={(event) => setRecognitionForm((current) => ({ ...current, option2: event.target.value }))} placeholder="Answer option 2" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={recognitionForm.option3} onChange={(event) => setRecognitionForm((current) => ({ ...current, option3: event.target.value }))} placeholder="Answer option 3" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={recognitionForm.option4} onChange={(event) => setRecognitionForm((current) => ({ ...current, option4: event.target.value }))} placeholder="Answer option 4" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
          </div>
          <label className="mt-3 block text-lg font-bold">
            Correct answer
            <select value={recognitionForm.correctAnswer} onChange={(event) => setRecognitionForm((current) => ({ ...current, correctAnswer: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              <option value="">Select correct answer</option>
              {['option1', 'option2', 'option3', 'option4'].map((key, index) => (
                <option key={key} value={recognitionForm[key]}>{`Option ${index + 1}: ${recognitionForm[key] || `Option ${index + 1}`}`}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold">
            Difficulty level
            <select value={recognitionForm.difficulty} onChange={(event) => setRecognitionForm((current) => ({ ...current, difficulty: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              {[1,2,3,4,5].map((level) => <option key={level} value={`Level ${level}`}>{`Level ${level}`}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold">
            Patient
            <input value={patient?.fullName || 'Current patient'} readOnly className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
          </label>
          {imageError ? <p className="mt-2 text-base font-bold text-orange-dark">{imageError}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="submit" className="min-h-14 rounded-2xl bg-green text-lg font-extrabold text-white">Save question</button>
            <button type="button" onClick={() => { setRecognitionForm(null); setImageError('') }} className="min-h-14 rounded-2xl border-2 border-line text-lg font-extrabold">Cancel</button>
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
