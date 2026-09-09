import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { DEMO_EVERYDAY_OBJECTS, DEMO_FAMILIAR_PEOPLE, DEMO_FAMILIAR_PLACES } from '../data/mock'
import { getCurrentDifficulty, getDifficultyCap, getLinkedPatient, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

const CONFIG = {
  people: { gameType: 'familiar-person', title: 'Who Is This?', prompt: 'Who is this?', items: DEMO_FAMILIAR_PEOPLE, label: (item) => `${item.name} — ${item.relationship}` },
  places: { gameType: 'familiar-place', title: 'Familiar Places', prompt: 'Which familiar place is this?', items: DEMO_FAMILIAR_PLACES, label: (item) => item.name },
  objects: { gameType: 'everyday-object', title: 'Everyday Objects', prompt: 'What is this?', items: DEMO_EVERYDAY_OBJECTS, label: (item) => item.name },
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

export default function RecognitionGame() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const config = CONFIG[kind] || CONFIG.people
  const [patientId, setPatientId] = useState(user?.id)
  const [question, setQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState('')
  const [startedAt, setStartedAt] = useState(Date.now())
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const item = config.items[question % config.items.length]
  const choices = useMemo(() => shuffle([item, ...shuffle(config.items.filter((candidate) => candidate.id !== item.id)).slice(0, 3)]), [item, config])

  useEffect(() => {
    getLinkedPatient(user).then((patient) => setPatientId(patient?.id || user.id))
  }, [user])

  useEffect(() => {
    voiceEngine.speak(tVoice(config.gameType === 'familiar-person' ? 'whoIsThis' : 'voiceGame'), voiceLang)
  }, [config.gameType, tVoice, voiceLang])

  async function choose(choice) {
    if (selected || done) return
    const nextAnswers = [...answers, { correct: choice.id === item.id, latency: Date.now() - startedAt }]
    setAnswers(nextAnswers)
    setSelected(choice.id)
    window.setTimeout(() => {
      if (question + 1 >= config.items.length) setDone(true)
      else {
        setQuestion((current) => current + 1)
        setSelected('')
        setStartedAt(Date.now())
      }
    }, 700)
  }

  useEffect(() => {
    if (!done || saved || !patientId) return
    const correctCount = answers.filter((answer) => answer.correct).length
    Promise.all([getCurrentDifficulty(patientId), getDifficultyCap(patientId)]).then(([difficulty, cap]) =>
      saveActivitySession({
        userId: patientId,
        gameType: config.gameType,
        game: config.title,
        score: correctCount * 10,
        accuracy: Math.round((correctCount / answers.length) * 100),
        reactionLatency: Math.round(answers.reduce((sum, answer) => sum + answer.latency, 0) / answers.length),
        difficulty: difficulty || cap,
        details: { answers },
      }),
    ).then(() => setSaved(true))
  }, [answers, config, done, patientId, saved])

  const correctCount = answers.filter((answer) => answer.correct).length
  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{config.title}</h1>
      <p className="mt-2 text-lg text-muted">{config.prompt}</p>
      {!done ? (
        <>
          <div className="mt-5 rounded-3xl border border-line bg-paper p-8 text-center">
            <div className="text-8xl" aria-hidden="true">{item.emoji}</div>
            <p className="mt-4 text-2xl font-extrabold">{config.prompt}</p>
            <p className="mt-2 text-lg text-muted">{question + 1} / {config.items.length}</p>
          </div>
          <div className="mt-5 grid gap-3">
            {choices.map((choice) => (
              <button key={choice.id} type="button" disabled={Boolean(selected)} onClick={() => choose(choice)} className={`min-h-16 rounded-2xl border-2 px-4 text-xl font-extrabold ${selected === choice.id ? (choice.id === item.id ? 'border-green bg-green/15' : 'border-orange bg-orange/15') : 'border-line bg-paper'}`}>
                {config.label(choice)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="mt-6 rounded-3xl border-2 border-green bg-paper p-7 text-center">
          <p className="text-3xl font-extrabold text-green-dark">{t('wellDone')}</p>
          <p className="mt-3 text-2xl font-bold">{correctCount} / {answers.length}</p>
          <p className="mt-2 text-lg font-semibold text-muted">{t('accuracy')}: {Math.round((correctCount / answers.length) * 100)}%</p>
          <button type="button" onClick={() => navigate('/patient')} className="mt-6 min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white">{t('backDashboard')}</button>
          {saved ? <p className="mt-3 text-base font-bold text-muted">Saved on this device.</p> : null}
        </section>
      )}
    </div>
  )
}
