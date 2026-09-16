import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import OfflineBanner from '../components/OfflineBanner'
import Toast from '../components/Toast'
import { LineChart } from '../components/SimpleChart'
import { LEVEL_ORDER, normalizeDifficultyLevel } from '../data/mock'
import {
  addTelemetry,
  getDifficultyCap,
  getDoctorAuthorized,
  getAuthorizedPatient,
  listCognitiveSessions,
  listFamiliarPeople,
  listFamiliarPlaces,
  listFamiliarThings,
  saveDifficultyCap,
  saveSettings,
  saveRecognitionItem,
  getStoryRecallQuestionCount,
  saveStoryRecallQuestionCount,
  listPendingRelationships,
  updateRelationshipStatus,
  getUser,
  addDailyTask,
  listDailyTasks,
  completeDailyTask,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import RecognitionContentManager from '../components/RecognitionContentManager'
import AIInsight from '../components/AIInsight'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [cap, setCap] = useState('Level 1')
  const [toast, setToast] = useState('')
  const [patient, setPatient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [authorized, setAuthorized] = useState(true)
  const [feedback, setFeedback] = useState('feedbackKeep')
  const [people, setPeople] = useState([])
  const [places, setPlaces] = useState([])
  const [things, setThings] = useState([])
  const [contentForm, setContentForm] = useState(null)
  const [contentError, setContentError] = useState('')
  const [requests, setRequests] = useState([])
  const [tasks, setTasks] = useState([])
  const [taskTitle, setTaskTitle] = useState('')
  const [storyRecallQuestionCount, setStoryRecallQuestionCount] = useState(5)

  function newContentForm(category) {
    return {
      category,
      question: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctAnswer: '',
      difficulty: 'Level 1',
      imageDataUrl: '',
      imageName: '',
      imageMime: '',
      name: '',
      detail: '',
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const pending = await listPendingRelationships(user)
      setRequests(await Promise.all(pending.map(async (request) => ({ ...request, patient: await getUser(request.patientId) }))))
      const linked = await getAuthorizedPatient(user)
      if (cancelled || !linked) return
      const [history, capLevel, authz, familiarPeople, familiarPlaces, familiarThings] = await Promise.all([
        listCognitiveSessions(linked.id),
        getDifficultyCap(linked.id),
        getDoctorAuthorized(linked.id),
        listFamiliarPeople(linked.id),
        listFamiliarPlaces(linked.id),
        listFamiliarThings(linked.id),
      ])
      setPatient(linked)
      setSessions(history)
      setCap(normalizeDifficultyLevel(capLevel, 'Level 3'))
      setAuthorized(authz)
      setPeople(familiarPeople)
      setPlaces(familiarPlaces)
      setThings(familiarThings)
      setStoryRecallQuestionCount(await getStoryRecallQuestionCount(linked.id))
      setTasks(await listDailyTasks(linked.id, new Date().toISOString().slice(0, 10)))
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
      : 0
  const avgAccuracy =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, row) => sum + (row.accuracy || 0), 0) / sessions.length)
      : 0
  const latencyData =
    sessions.length > 0
      ? sessions
          .slice(0, 7)
          .reverse()
          .map((row) => ({ day: row.dateLabel || '', ms: row.avgReactionMs || 0 }))
      : []

  async function applyCap(level) {
    if (!patient) return
    setCap(level)
    await saveDifficultyCap(patient.id, level)
    setToast(`${t('currentCap')}: ${level}`)
  }

  async function updateStoryRecallQuestionCount(event) {
    const value = Number(event.target.value)
    if (!patient) return
    try {
      await saveStoryRecallQuestionCount(patient.id, value, user)
      setStoryRecallQuestionCount(value)
      setToast('Story Recall question count saved.')
    } catch {
      setToast('You are not authorized to change this setting.')
    }
  }

  async function saveFeedback() {
    if (!patient) return
    await saveSettings(patient.id, { doctorFeedback: feedback })
    await addTelemetry({ userId: patient.id, kind: 'doctor_feedback', data: { feedback } })
    setToast(t('feedbackSaved'))
  }

  async function addTask(event) {
    event.preventDefault()
    if (!patient || !taskTitle.trim()) return
    await addDailyTask(patient.id, user.id, { title: taskTitle, createdByRole: 'doctor' })
    setTaskTitle('')
    setTasks(await listDailyTasks(patient.id, new Date().toISOString().slice(0, 10)))
    setToast('Daily task saved.')
  }

  async function handleContentSave(event) {
    event.preventDefault()
    if (!patient || !contentForm?.question?.trim()) return
    const imageDataUrl = contentForm.imageDataUrl || ''
    const options = [contentForm.option1, contentForm.option2, contentForm.option3, contentForm.option4].map((value) => String(value || '').trim()).filter(Boolean)
    if (!imageDataUrl) {
      setContentError('Please upload an image before saving.')
      return
    }
    if (options.length !== 4) {
      setContentError('Please provide exactly four answer options.')
      return
    }
    if (!contentForm.correctAnswer || !options.includes(contentForm.correctAnswer)) {
      setContentError('Please choose one of the four options as the correct answer.')
      return
    }
    await saveRecognitionItem({
      patientId: patient.id,
      category: contentForm.category,
      kind: contentForm.category,
      question: contentForm.question.trim(),
      options,
      correctAnswer: contentForm.correctAnswer,
      difficulty: contentForm.difficulty || 'Level 1',
      name: contentForm.name || contentForm.correctAnswer,
      relationship: contentForm.detail || contentForm.correctAnswer,
      description: contentForm.detail || contentForm.question,
      imageDataUrl,
      imageName: contentForm.imageName || 'uploaded-image',
      imageMime: contentForm.imageMime || 'image/png',
      createdByRole: 'doctor',
    })
    const [freshPeople, freshPlaces, freshThings] = await Promise.all([
      listFamiliarPeople(patient.id),
      listFamiliarPlaces(patient.id),
      listFamiliarThings(patient.id),
    ])
    setPeople(freshPeople)
    setPlaces(freshPlaces)
    setThings(freshThings)
    setContentForm(null)
    setContentError('')
    setToast('Recognition image saved on this device.')
  }

  async function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setContentError('Please choose an image file only.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setContentError('Image must be smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setContentForm((current) => ({ ...current, imageDataUrl: String(reader.result || ''), imageName: file.name, imageMime: file.type }))
      setContentError('')
    }
    reader.onerror = () => { setContentError('Image could not be loaded. Please choose another file.') }
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 pb-28">
      <TopBar showHome={false} showExit />
      <h1 className="text-3xl font-extrabold">{t('doctor')}</h1>
      <p className="mt-1 text-xl text-muted">Welcome, {user?.fullName || t('doctor')}</p>
      <div className="mt-4">
        <OfflineBanner />
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('patientOverview')}</h2>
        <p className="mt-2 text-2xl font-extrabold">{patient?.fullName || 'No connected patient yet'}</p>
        <p className="text-lg text-muted">
          {patient ? `${patient.age} · ${patient.location}` : 'Accept a patient connection request to view data.'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric label={t('accuracy')} value={sessions.length ? `${latest?.accuracy ?? avgAccuracy}%` : 'No data'} />
          <Metric label={t('avgReaction')} value={sessions.length ? `${avgLatency} ms` : 'No data'} />
          <Metric label={t('difficulty')} value={latest?.difficulty || 'No data'} />
          <Metric label={t('gameSessions')} value={String(sessions.length)} />
        </div>
      </section>

      {requests.length ? (
        <section className="mt-4 rounded-3xl border-2 border-orange bg-paper p-5">
          <h2 className="text-xl font-extrabold">Patient Connection Requests</h2>
          <div className="mt-3 space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-cream p-4">
                <p className="text-lg font-bold">{request.patient?.fullName || 'Patient'} wants to connect with you as their doctor.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={async () => { await updateRelationshipStatus(request.id, 'accepted', user); setRequests((current) => current.filter((item) => item.id !== request.id)); window.location.reload() }} className="min-h-12 rounded-xl bg-green text-base font-extrabold text-white">Accept</button>
                  <button type="button" onClick={async () => { await updateRelationshipStatus(request.id, 'rejected', user); setRequests((current) => current.filter((item) => item.id !== request.id)) }} className="min-h-12 rounded-xl bg-orange text-base font-extrabold text-white">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <p className="text-lg font-extrabold">{t('caregiverAuth')}</p>
        <p className="mt-2 text-xl font-bold">{authorized ? t('authorized') : t('notAuthorized')}</p>
      </section>

      <RecognitionContentManager patientId={patient?.id} role="doctor" />

      {contentForm ? (
        <form onSubmit={handleContentSave} className="mt-4 rounded-3xl border-2 border-blue bg-paper p-5">
          <h2 className="text-xl font-extrabold">{contentForm.category === 'person' ? 'Add Person Question' : contentForm.category === 'place' ? 'Add Place Question' : 'Add Thing Question'}</h2>
          <label className="mt-3 block text-lg font-bold">
            Category
            <select value={contentForm.category} onChange={(event) => setContentForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              <option value="person">Person</option>
              <option value="place">Place</option>
              <option value="thing">Thing</option>
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold text-ink">
            Upload image
            <input type="file" accept="image/*" onChange={(event) => addImageFile(event.target.files?.[0])} className="mt-2 block w-full rounded-2xl border-2 border-dashed border-line bg-cream p-3 text-base" />
          </label>
          {contentForm.imageDataUrl ? (
            <div className="mt-3 rounded-2xl border border-line bg-cream p-3">
              <img src={contentForm.imageDataUrl} alt="Preview" className="mx-auto h-36 w-full rounded-xl object-contain" />
            </div>
          ) : null}
          <input
            required
            value={contentForm.question}
            onChange={(event) => setContentForm((current) => ({ ...current, question: event.target.value }))}
            placeholder="What place is this?"
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={contentForm.option1} onChange={(event) => setContentForm((current) => ({ ...current, option1: event.target.value }))} placeholder="Answer option 1" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={contentForm.option2} onChange={(event) => setContentForm((current) => ({ ...current, option2: event.target.value }))} placeholder="Answer option 2" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={contentForm.option3} onChange={(event) => setContentForm((current) => ({ ...current, option3: event.target.value }))} placeholder="Answer option 3" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
            <input value={contentForm.option4} onChange={(event) => setContentForm((current) => ({ ...current, option4: event.target.value }))} placeholder="Answer option 4" className="min-h-14 rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
          </div>
          <label className="mt-3 block text-lg font-bold">
            Correct answer
            <select value={contentForm.correctAnswer} onChange={(event) => setContentForm((current) => ({ ...current, correctAnswer: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              <option value="">Select correct answer</option>
              {['option1', 'option2', 'option3', 'option4'].map((key, index) => (
                <option key={key} value={contentForm[key]}>{`Option ${index + 1}: ${contentForm[key] || `Option ${index + 1}`}`}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold">
            Difficulty level
            <select value={contentForm.difficulty || 'Level 1'} onChange={(event) => setContentForm((current) => ({ ...current, difficulty: event.target.value }))} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl">
              {[1,2,3,4,5].map((level) => <option key={level} value={`Level ${level}`}>{`Level ${level}`}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-lg font-bold">
            Patient association
            <input value={patient?.fullName || 'Current patient'} readOnly className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl" />
          </label>
          {contentError ? <p className="mt-2 text-base font-bold text-orange-dark">{contentError}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="submit" className="min-h-14 rounded-2xl bg-green text-lg font-extrabold text-white">Save</button>
            <button type="button" onClick={() => { setContentForm(null); setContentError('') }} className="min-h-14 rounded-2xl border-2 border-line text-lg font-extrabold">Cancel</button>
          </div>
        </form>
      ) : null}

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Recognition Library</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">People</p>
            <p className="mt-1 text-muted">{people.length} saved</p>
            <button type="button" onClick={() => setContentForm(newContentForm('person'))} className="mt-3 min-h-12 rounded-xl bg-green px-4 text-base font-extrabold text-white">Add Person</button>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">Places</p>
            <p className="mt-1 text-muted">{places.length} saved</p>
            <button type="button" onClick={() => setContentForm(newContentForm('place'))} className="mt-3 min-h-12 rounded-xl bg-blue px-4 text-base font-extrabold text-white">Add Place</button>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-lg font-extrabold">Things</p>
            <p className="mt-1 text-muted">{things.length} saved</p>
            <button type="button" onClick={() => setContentForm(newContentForm('thing'))} className="mt-3 min-h-12 rounded-xl bg-orange px-4 text-base font-extrabold text-white">Add Thing</button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <LineChart data={latencyData} label={t('latencyTrend')} />
      </section>

      <AIInsight sessions={sessions} title="AI Activity Summary" />

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
          {patient ? t('lookingAfter', { name: patient.fullName }) : 'No connected patient yet.'}
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
        <h2 className="text-xl font-extrabold">Story Recall Questions</h2>
        <p className="mt-1 text-muted">Choose the maximum number of questions for the connected patient.</p>
        <select value={storyRecallQuestionCount} onChange={updateStoryRecallQuestionCount} className="mt-3 min-h-12 w-full rounded-xl border-2 border-line bg-cream px-3 text-lg">
          {[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
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

      <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">Daily Tasks</h2>
        <form onSubmit={addTask} className="mt-3 flex gap-2">
          <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Add a task" className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-line bg-cream px-3 text-lg" />
          <button type="submit" className="min-h-12 rounded-xl bg-green px-4 font-extrabold text-white">Add</button>
        </form>
        <div className="mt-3 space-y-2">
          {tasks.length ? tasks.map((task) => (
            <label key={task.id} className="flex items-center gap-3 rounded-xl bg-cream p-3 text-lg font-bold">
              <input type="checkbox" checked={task.completed} onChange={async (event) => { await completeDailyTask(task.id, patient?.id, event.target.checked); setTasks(await listDailyTasks(patient.id, new Date().toISOString().slice(0, 10))) }} className="h-6 w-6" />
              {task.title}
            </label>
          )) : <p className="text-muted">No daily tasks yet.</p>}
        </div>
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
