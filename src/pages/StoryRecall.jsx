import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import {
  DEFAULT_STORY_RECALL_QUESTION_COUNT,
  normalizeDifficultyLevel,
  storyRecallPlan,
  STORY_RECALL_ANSWERS,
  STORY_RECALL_STORIES,
} from '../data/mock'
import {
  addTelemetry,
  getCurrentDifficulty,
  getLinkedPatient,
  getStoryRecallQuestionCount,
  saveActivitySession,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function StoryRecall() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, voiceLang, voiceEnabled } = useI18n()
  const [level, setLevel] = useState('Level 1')
  const [questionCount, setQuestionCount] = useState(DEFAULT_STORY_RECALL_QUESTION_COUNT)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState({})
  const [answerFeedback, setAnswerFeedback] = useState(null)
  const [answers, setAnswers] = useState([])
  const [saved, setSaved] = useState(false)
  const [storyId, setStoryId] = useState(STORY_RECALL_STORIES[0].id)
  const [voiceMessage, setVoiceMessage] = useState('')
  const narratedKeyRef = useRef('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const patientId = patient?.id || user.id
      const [current, configuredCount] = await Promise.all([
        getCurrentDifficulty(patientId),
        getStoryRecallQuestionCount(patientId),
      ])
      if (!cancelled) {
        setLevel(normalizeDifficultyLevel(current, 'Level 1'))
        setQuestionCount(configuredCount)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const plan = useMemo(
    () => storyRecallPlan(level, storyId, questionCount),
    [level, questionCount, storyId],
  )
  const totalQuestions = plan.questions.length
  const currentQuestion = plan.questions[questionIndex] || plan.questions[0]
  const options = useMemo(
    () => STORY_RECALL_ANSWERS[currentQuestion] || [],
    [currentQuestion],
  )

  const chooseAnswer = useCallback((value) => {
    setSelected((current) => ({ ...current, [questionIndex]: value }))
    setAnswerFeedback(value === options[0])
  }, [options, questionIndex])

  const narrationText = useCallback(() => {
    const spokenOptions = options
      .map((option, index) => `Option ${'ABCD'[index]}. ${option}.`)
      .join(' ')
    const story = questionIndex === 0 ? `Story: ${plan.title}. ${plan.body}. ` : ''
    return `${story}Question ${questionIndex + 1} of ${totalQuestions}. ${currentQuestion}. ${spokenOptions}`
  }, [currentQuestion, options, plan.body, plan.title, questionIndex, totalQuestions])

  const readQuestion = useCallback(() => {
    if (!voiceEnabled) {
      setVoiceMessage('Turn Voice Assistant on to hear the question.')
      return
    }
    voiceEngine.speak(narrationText(), voiceLang, {
      onError: () => setVoiceMessage('Narration is unavailable. You can still answer manually.'),
    })
  }, [narrationText, voiceEnabled, voiceLang])

  useEffect(() => {
    if (!voiceEnabled || saved || !currentQuestion) return
    const key = `${storyId}:${level}:${questionIndex}:${totalQuestions}:${currentQuestion}`
    if (narratedKeyRef.current === key) return
    narratedKeyRef.current = key
    readQuestion()
  }, [currentQuestion, level, questionIndex, readQuestion, saved, storyId, totalQuestions, voiceEnabled])

  useEffect(() => () => voiceEngine.cancel(), [])

  async function finishSession() {
    const patient = await getLinkedPatient(user)
    const userId = patient?.id || user.id
    const correct = plan.questions.map((question, index) => (
      selected[index] === (STORY_RECALL_ANSWERS[question]?.[0] || '')
    ))
    const accuracy = Math.round((correct.filter(Boolean).length / Math.max(correct.length, 1)) * 100)
    const details = plan.questions.map((question, index) => ({
      question,
      selectedAnswer: selected[index] || '',
      correctAnswer: STORY_RECALL_ANSWERS[question]?.[0] || '',
      isCorrect: correct[index],
    }))
    await saveActivitySession({
      userId,
      gameType: 'story-recall',
      game: 'Story Recall',
      score: accuracy,
      accuracy,
      difficulty: level,
      details,
    })
    await addTelemetry({
      userId,
      kind: 'story_recall_answers',
      data: { storyId, questionCount: totalQuestions, accuracy },
    })
    setAnswers(correct)
    setSaved(true)
    voiceEngine.cancel()
  }

  async function nextQuestion() {
    if (questionIndex + 1 >= totalQuestions) {
      await finishSession()
      return
    }
    setQuestionIndex((current) => current + 1)
    setAnswerFeedback(null)
    setVoiceMessage('')
  }

  function retry() {
    setQuestionIndex(0)
    setSelected({})
    setAnswerFeedback(null)
    setAnswers([])
    setSaved(false)
    setVoiceMessage('')
    narratedKeyRef.current = ''
  }

  function changeStory(nextStoryId) {
    voiceEngine.cancel()
    setStoryId(nextStoryId)
    retry()
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('storyRecall')}</h1>
      <p className="mt-2 text-lg text-muted">{t('storyHint')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STORY_RECALL_STORIES.map((story) => (
          <button key={story.id} type="button" onClick={() => changeStory(story.id)} className={`rounded-xl border-2 px-3 py-2 font-bold ${storyId === story.id ? 'border-blue bg-blue text-white' : 'border-line bg-cream'}`}>
            {story.title}
          </button>
        ))}
      </div>

      {!saved ? (
        <>
          <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
            <p className="text-sm font-extrabold uppercase tracking-wide text-blue-dark">Story</p>
            <h2 className="mt-1 text-2xl font-extrabold">{plan.title}</h2>
            <p className="mt-3 text-lg leading-relaxed">{plan.body}</p>
          </section>
          <form onSubmit={(event) => { event.preventDefault(); nextQuestion() }} className="mt-5 space-y-5 rounded-3xl border border-line bg-paper p-5">
          <p className="text-lg font-extrabold text-blue-dark">Question {questionIndex + 1} of {totalQuestions}</p>
          <h2 className="text-2xl font-extrabold">{currentQuestion}</h2>
          <button type="button" onClick={readQuestion} className="min-h-12 rounded-2xl bg-blue px-4 text-lg font-extrabold text-white">
            🔊 Read Question
          </button>
          <div className="space-y-2">
            {options.map((option, optionIndex) => (
              <button key={option} type="button" onClick={() => chooseAnswer(option)} className={`block min-h-14 w-full rounded-2xl border-2 px-4 text-left text-lg font-bold ${selected[questionIndex] === option ? 'border-blue bg-blue text-white' : 'border-line bg-cream'}`}>
                <span className="mr-2" aria-hidden="true">{'ABCD'[optionIndex]}.</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          {answerFeedback !== null ? (
            <p className={`font-bold ${answerFeedback ? 'text-green-dark' : 'text-orange-dark'}`}>
              {answerFeedback ? 'Correct! Well remembered.' : `Not quite. Correct answer: ${options[0]}`}
            </p>
          ) : null}
          <button type="submit" disabled={answerFeedback === null} className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white disabled:opacity-50">
            {questionIndex + 1 >= totalQuestions ? 'Finish Session' : 'Next Question'}
          </button>
          {voiceMessage ? <p role="status" className="font-semibold text-orange-dark">{voiceMessage}</p> : null}
          </form>
        </>
      ) : (
        <section className="mt-5 space-y-4 rounded-3xl border border-line bg-paper p-5">
          <p className="text-xl font-extrabold">Story Recall complete</p>
          <p className="text-lg">You answered {answers.filter(Boolean).length} of {answers.length} questions correctly.</p>
          <button type="button" onClick={retry} className="min-h-14 w-full rounded-2xl bg-orange text-xl font-extrabold text-white">{t('playAgain')}</button>
          <button type="button" onClick={() => navigate('/patient')} className="min-h-14 w-full rounded-2xl border-2 border-line text-xl font-extrabold">{t('backDashboard')}</button>
        </section>
      )}
    </div>
  )
}
