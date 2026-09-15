import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { normalizeDifficultyLevel, storyRecallPlan, levelNumber } from '../data/mock'
import { getCurrentDifficulty, getLinkedPatient, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

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

function durationFor(level) {
  const n = levelNumber(level)
  return n <= 1 ? EASY_STORY_DURATION : n >= 4 ? HARD_STORY_DURATION : MEDIUM_STORY_DURATION
}

export default function StoryRecall() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [level, setLevel] = useState('Level 1')
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState({})
  const [hidden, setHidden] = useState(false)
  const [remaining, setRemaining] = useState(EASY_STORY_DURATION)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const current = normalizeDifficultyLevel(await getCurrentDifficulty(patient?.id || user.id), 'Level 1')
      if (!cancelled) setLevel(current)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const plan = useMemo(() => storyRecallPlan(level), [level])
  const duration = durationFor(level)

  useEffect(() => {
    setHidden(false)
    setRemaining(duration)
    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(interval)
          setHidden(true)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [duration, plan.body])

  function choose(index, value) {
    setSelected((current) => ({ ...current, [index]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const patient = await getLinkedPatient(user)
    const userId = patient?.id || user.id
    const correct = plan.questions.map((question) => ANSWERS[question]?.[0] || '').map((answer, index) => selected[index] === answer)
    const accuracy = Math.round((correct.filter(Boolean).length / Math.max(correct.length, 1)) * 100)
    const details = plan.questions.map((question, index) => ({ question, selectedAnswer: selected[index] || '', correctAnswer: ANSWERS[question]?.[0] || '', isCorrect: correct[index] }))
    await saveActivitySession({ userId, gameType: 'story-recall', game: 'Story Recall', score: accuracy, accuracy, difficulty: level, details })
    setAnswers(correct)
    setSaved(true)
  }

  function retry() {
    setAnswers([])
    setSelected({})
    setSaved(false)
    setHidden(false)
    setRemaining(duration)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('storyRecall')}</h1>
      <p className="mt-2 text-lg text-muted">{t('storyHint')}</p>
      <p className="mt-2 text-base font-extrabold text-blue-dark">{t('difficultyLabel')}: {level} · Story time: {remaining}s</p>
      {!hidden ? (
        <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
          <h2 className="text-xl font-extrabold">{t('storyTitle')}</h2>
          <p className="mt-3 text-xl leading-relaxed">{plan.body}</p>
          <button type="button" onClick={() => voiceEngine.speak(tVoice('storyBody'), voiceLang)} className="mt-4 min-h-14 rounded-2xl bg-blue px-5 text-lg font-extrabold text-white">{t('voiceAssist')}</button>
        </section>
      ) : null}
      <form onSubmit={submit} className="mt-5 space-y-5 rounded-3xl border border-line bg-paper p-5">
        {plan.questions.map((question, index) => (
          <fieldset key={question} className="space-y-2">
            <legend className="text-xl font-extrabold">{question}</legend>
            {(ANSWERS[question] || []).map((option) => (
              <button key={option} type="button" onClick={() => choose(index, option)} className={`block min-h-14 w-full rounded-2xl border-2 px-4 text-left text-lg font-bold ${selected[index] === option ? 'border-blue bg-blue text-white' : 'border-line bg-cream'}`}>
                {option}
              </button>
            ))}
            {saved ? <p className={`font-bold ${answers[index] ? 'text-green-dark' : 'text-orange-dark'}`}>{answers[index] ? 'Correct! Well remembered.' : `Not quite. Correct answer: ${ANSWERS[question]?.[0]}`}</p> : null}
          </fieldset>
        ))}
        {!saved ? <button type="submit" disabled={Object.keys(selected).length !== plan.questions.length} className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white disabled:opacity-50">Check answers</button> : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={retry} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">{t('playAgain')}</button>
            <button type="button" onClick={() => navigate('/patient')} className="min-h-14 rounded-2xl border-2 border-line text-xl font-extrabold">{t('backDashboard')}</button>
          </div>
        )}
      </form>
    </div>
  )
}
