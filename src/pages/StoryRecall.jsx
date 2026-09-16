import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { normalizeDifficultyLevel, storyRecallPlan, levelNumber } from '../data/mock'
import { getCurrentDifficulty, getLinkedPatient, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { startSpeechRecognition, voiceEngine } from '../voice/speech'

export const EASY_STORY_DURATION = 25
export const MEDIUM_STORY_DURATION = 18
export const HARD_STORY_DURATION = 12

const ANSWERS = {
  'Where did Mina walk?': ['The tea stall', 'The market', 'The school', 'The clinic'],
  'What did she buy?': ['Two cups of tea and a snack', 'A book', 'Vegetables', 'Medicine'],
  'Where did she sit?': ['Under the old banyan tree', 'At home', 'Near the school', 'In the market'],
  'Who sat with Mina?': ['Her daughter', 'Her doctor', 'Her neighbor', 'Her grandson'],
  'What did they talk about?': ['The family garden', 'The weather', 'A new song', 'The market'],
  'What happened before sunset?': ['Mina returned home', 'Mina went to school', 'Mina bought medicine', 'Mina called the doctor'],
}

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
function voiceChoice(transcripts, options) {
  for (const transcript of transcripts) {
    const spoken = normalize(transcript)
    const letter = spoken.match(/^(?:option\s+)?([abcd])(?:\s|$)/)?.[1]
    const ordinal = spoken.match(/\b(first|one|second|two|third|three|fourth|four)\b/)?.[1]
    const index = letter ? 'abcd'.indexOf(letter) : ({ first: 0, one: 0, second: 1, two: 1, third: 2, three: 2, fourth: 3, four: 3 })[ordinal]
    if (Number.isInteger(index) && options[index]) return options[index]
    const exact = options.find((option) => normalize(option) === spoken)
    if (exact) return exact
    const contained = options.find((option) => spoken.includes(normalize(option)) || normalize(option).includes(spoken))
    if (contained) return contained
  }
  return null
}
function durationFor(level) {
  const n = levelNumber(level)
  return n <= 1 ? EASY_STORY_DURATION : n >= 4 ? HARD_STORY_DURATION : MEDIUM_STORY_DURATION
}

export default function StoryRecall() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, voiceLang, voiceEnabled } = useI18n()
  const [level, setLevel] = useState('Level 1')
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState({})
  const [hidden, setHidden] = useState(false)
  const [remaining, setRemaining] = useState(EASY_STORY_DURATION)
  const [saved, setSaved] = useState(false)
  const [round, setRound] = useState(0)
  const [listening, setListening] = useState(null)
  const [voiceNote, setVoiceNote] = useState('')
  const questionStartedAt = useRef({})
  const recognition = useRef(null)

  useEffect(() => {
    let cancelled = false
    getLinkedPatient(user).then(async (patient) => {
      const current = normalizeDifficultyLevel(await getCurrentDifficulty(patient?.id || user.id), 'Level 1')
      if (!cancelled) setLevel(current)
    })
    return () => { cancelled = true }
  }, [user])

  const plan = useMemo(() => storyRecallPlan(level), [level])
  const duration = durationFor(level)
  useEffect(() => {
    setHidden(false)
    setRemaining(duration)
    setSelected({})
    setAnswers([])
    setSaved(false)
    recognition.current?.stop()
    const interval = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) { window.clearInterval(interval); setHidden(true); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(interval)
  }, [duration, plan.body, round])

  useEffect(() => {
    if (!hidden) return undefined
    questionStartedAt.current = Object.fromEntries(plan.questions.map((_, index) => [index, Date.now()]))
    if (voiceEnabled) voiceEngine.speak(`${plan.questions[0]}. ${ANSWERS[plan.questions[0]]?.map((option, index) => `Option ${'ABCD'[index]}, ${option}`).join('. ')}`, voiceLang)
    return () => recognition.current?.stop()
  }, [hidden, plan.questions, voiceEnabled, voiceLang])

  function choose(index, value) {
    if (saved) return
    setSelected((current) => ({ ...current, [index]: value }))
    setListening(null)
  }
  function listen(index) {
    const options = ANSWERS[plan.questions[index]] || []
    setVoiceNote('')
    recognition.current?.stop()
    const result = startSpeechRecognition({
      lang: voiceLang,
      onResult: (transcripts) => {
        const option = voiceChoice(transcripts, options)
        if (option) choose(index, option)
        else setVoiceNote('I could not match that answer. Please choose an option.')
      },
      onError: (reason) => setVoiceNote(reason === 'not-allowed' || reason === 'service-not-allowed' ? 'Microphone permission was denied. Please select an answer.' : 'Voice input is unavailable. Please select an answer.'),
      onEnd: () => setListening(null),
    })
    if (!result.ok) setVoiceNote('Speech recognition is not supported here. Please select an answer.')
    else { recognition.current = result; setListening(index) }
  }
  async function submit(event) {
    event.preventDefault()
    const patient = await getLinkedPatient(user)
    const userId = patient?.id || user.id
    const questions = plan.questions.map((question, index) => {
      const correctAnswer = ANSWERS[question]?.[0] || ''
      return { question, selectedAnswer: selected[index] || '', correctAnswer, isCorrect: selected[index] === correctAnswer, responseTimeMs: Math.max(0, Date.now() - (questionStartedAt.current[index] || Date.now())) }
    })
    const accuracy = Math.round((questions.filter((item) => item.isCorrect).length / Math.max(questions.length, 1)) * 100)
    await saveActivitySession({ userId, gameType: 'story-recall', game: 'Story Recall', score: accuracy, accuracy, difficulty: level, details: questions })
    setAnswers(questions.map((item) => item.isCorrect))
    setSaved(true)
    recognition.current?.stop()
  }
  function retry() { setVoiceNote(''); setListening(null); recognition.current?.stop(); setRound((value) => value + 1) }

  return <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
    <TopBar backTo="/patient" backLabel={t('dashboard')} />
    <h1 className="text-3xl font-extrabold">{t('storyRecall')}</h1>
    <p className="mt-2 text-lg text-muted">{t('storyHint')}</p>
    <p className="mt-2 text-base font-extrabold text-blue-dark">{t('difficultyLabel')}: {level} · Story time: {remaining}s</p>
    {!hidden ? <section className="mt-5 rounded-3xl border border-line bg-paper p-5"><h2 className="text-xl font-extrabold">{t('storyTitle')}</h2><p className="mt-3 text-xl leading-relaxed">{plan.body}</p>{voiceEnabled ? <button type="button" onClick={() => voiceEngine.speak(plan.body, voiceLang)} className="mt-4 min-h-14 rounded-2xl bg-blue px-5 text-lg font-extrabold text-white">{t('voiceAssist')}</button> : null}</section> : null}
    {hidden ? <form onSubmit={submit} className="mt-5 space-y-5 rounded-3xl border border-line bg-paper p-5">
      {plan.questions.map((question, index) => <fieldset key={question} className="space-y-2"><legend className="text-xl font-extrabold">{question}</legend>{(ANSWERS[question] || []).map((option, optionIndex) => <button key={option} type="button" onClick={() => choose(index, option)} className={`block min-h-14 w-full rounded-2xl border-2 px-4 text-left text-lg font-bold ${selected[index] === option ? 'border-blue bg-blue text-white' : 'border-line bg-cream'}`}>{`${'ABCD'[optionIndex]}. ${option}`}</button>)}<button type="button" onClick={() => listen(index)} disabled={listening === index || saved} className="min-h-12 rounded-xl border-2 border-blue px-4 font-extrabold text-blue-dark disabled:opacity-50">{listening === index ? 'Listening…' : 'Answer by voice'}</button>{saved ? <p className={`font-bold ${answers[index] ? 'text-green-dark' : 'text-orange-dark'}`}>{answers[index] ? '✓ Correct! Well remembered.' : `✕ Not quite. The correct answer was: ${ANSWERS[question]?.[0]}`}</p> : null}</fieldset>)}
      {voiceNote ? <p className="font-bold text-orange-dark">{voiceNote}</p> : null}
      {!saved ? <button type="submit" disabled={Object.keys(selected).length !== plan.questions.length} className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white disabled:opacity-50">Check answers</button> : <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={retry} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">{t('playAgain')}</button><button type="button" onClick={() => navigate('/patient')} className="min-h-14 rounded-2xl border-2 border-line text-xl font-extrabold">{t('backDashboard')}</button></div>}
    </form> : null}
  </div>
}
