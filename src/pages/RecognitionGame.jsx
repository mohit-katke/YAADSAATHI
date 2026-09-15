import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { normalizeDifficultyLevel } from '../data/mock'
import { getCurrentDifficulty, getDifficultyCap, getLinkedPatient, listRecognitionItems, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

const CONFIG = {
  people: { gameType: 'familiar-person', titleKey: 'whoIsThis', promptKey: 'whoIsThis' },
  places: { gameType: 'familiar-place', titleKey: 'familiarPlaces', promptKey: 'familiarPlaces' },
  objects: { gameType: 'everyday-object', titleKey: 'everydayObjects', promptKey: 'everydayObjects' },
}

function normalizeQuestionItem(item, kind) {
  if (!item) return null
  const hasStoredOptions = Array.isArray(item.options) && item.options.length >= 4
  const safeOptions = hasStoredOptions
    ? item.options.slice(0, 4).map((option) => String(option || '').trim()).filter(Boolean)
    : [item.name || 'Option 1', 'Incorrect option 1', 'Incorrect option 2', 'Incorrect option 3']
  const fallbackCorrect = item.correctAnswer || item.name || item.relationship || safeOptions[0]
  return {
    ...item,
    id: String(item.id || `${kind}-${Date.now()}`),
    name: item.name || fallbackCorrect,
    question: item.question || '',
    options: safeOptions.slice(0, 4),
    correctAnswer: String(fallbackCorrect || safeOptions[0] || '').trim(),
    imageDataUrl: item.imageDataUrl || item.imageBlob || item.imageAsset || '',
  }
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function itemImage(item) {
  if (!item) return null
  if (item.imageDataUrl) return item.imageDataUrl
  if (item.imageAsset) return item.imageAsset
  return null
}

export default function RecognitionGame() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const config = CONFIG[kind] || CONFIG.people
  const [patientId, setPatientId] = useState(user?.id)
  const [level, setLevel] = useState('Level 1')
  const [items, setItems] = useState([])
  const [question, setQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState('')
  const [startedAt, setStartedAt] = useState(Date.now())
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState(false)

  const expectedKind = kind === 'people' ? 'person' : kind === 'places' ? 'place' : 'thing'

  async function loadSession() {
    const patient = await getLinkedPatient(user)
    const nextUserId = patient?.id || user.id
    const currentLevel = normalizeDifficultyLevel(await getCurrentDifficulty(nextUserId), 'Level 1')
    const recognitionItems = await listRecognitionItems(nextUserId)
    const byKind = recognitionItems.filter((item) => (item.category || item.kind) === expectedKind)
    const savedQuestions = byKind.filter((item) => item.createdBy && Array.isArray(item.options) && item.options.length >= 4)
    const questionPool = savedQuestions.length ? savedQuestions : byKind
    const levelQuestions = questionPool.filter((item) => normalizeDifficultyLevel(item.difficulty || 'Level 1', 'Level 1') === currentLevel)
    const nearbyQuestions = questionPool.filter((item) => Math.abs(Number(item.difficulty?.replace(/\D/g, '')) - Number(currentLevel.replace(/\D/g, ''))) <= 1 || normalizeDifficultyLevel(item.difficulty || 'Level 1', 'Level 1') === currentLevel)
    const sourceItems = levelQuestions.length ? levelQuestions : nearbyQuestions.length ? nearbyQuestions : questionPool
    const uniqueItems = [...new Map(sourceItems.map((item) => [item.id, item])).values()]
    const nextItems = shuffle(uniqueItems).slice(0, 5)
      .map((item) => normalizeQuestionItem(item, expectedKind))
      .filter(Boolean)

    setPatientId(nextUserId)
    setLevel(currentLevel)
    setItems(nextItems)
    setQuestion(0)
    setAnswers([])
    setSelected('')
    setFeedback('')
    setDone(false)
    setSaved(false)
    setStartedAt(Date.now())
  }

  useEffect(() => {
    let cancelled = false
    loadSession().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [kind, user])

  const item = items[question % Math.max(1, items.length)]
  const normalizedItem = normalizeQuestionItem(item, kind === 'people' ? 'person' : kind === 'places' ? 'place' : 'thing') || {
    id: 'fallback',
    name: 'Choice',
    question: 'What is this?',
    options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
    correctAnswer: 'Choice A',
    imageDataUrl: '',
  }
  const sessionQuestionCount = Math.min(5, items.length)
  const choices = useMemo(() => {
    if (!normalizedItem) return []
    if (Array.isArray(normalizedItem.options) && normalizedItem.options.length >= 4) {
      return shuffle(normalizedItem.options.slice(0, 4))
    }
    const uniqueOptions = [...new Set([...(normalizedItem.options || []), ...items.filter((candidate) => candidate.id !== normalizedItem.id).map((candidate) => candidate.correctAnswer || candidate.name || '').filter(Boolean)])]
    const distractors = uniqueOptions.filter((option) => option !== normalizedItem.correctAnswer)
    const optionPool = shuffle([
      normalizedItem.correctAnswer,
      ...distractors.slice(0, 3),
    ])
    const finalOptions = optionPool.length >= 4 ? optionPool.slice(0, 4) : [...optionPool, ...Array.from({ length: 4 - optionPool.length }, (_, idx) => `Choice ${idx + 1}`)]
    return shuffle(finalOptions).slice(0, 4)
  }, [items, normalizedItem])

  useEffect(() => {
    voiceEngine.speak(tVoice(config.gameType === 'familiar-person' ? 'whoIsThis' : 'voiceGame'), voiceLang)
  }, [config.gameType, tVoice, voiceLang])

  async function choose(choice) {
    if (selected || done) return
    const correct = String(choice) === String(normalizedItem.correctAnswer)
    const nextAnswers = [...answers, { correct, selected: choice, correctAnswer: normalizedItem.correctAnswer, latency: Date.now() - startedAt }]
    setAnswers(nextAnswers)
    setSelected(choice)
    setFeedback(correct ? t('correct') : `${t('incorrect')}. ${normalizedItem.correctAnswer}`)
  }

  function nextQuestion() {
    if (question + 1 >= sessionQuestionCount) {
      setDone(true)
      return
    }
    setQuestion((current) => current + 1)
    setSelected('')
    setFeedback('')
    setStartedAt(Date.now())
  }

  async function playAgain() {
    await loadSession()
  }

  useEffect(() => {
    if (!done || saved || !patientId) return
    const correctCount = answers.filter((answer) => answer.correct).length
    Promise.all([getCurrentDifficulty(patientId), getDifficultyCap(patientId)]).then(([difficulty, cap]) =>
      saveActivitySession({
        userId: patientId,
        gameType: config.gameType,
        game: config.titleKey,
        score: correctCount * 10,
        accuracy: answers.length ? Math.round((correctCount / answers.length) * 100) : 0,
        reactionLatency: answers.length ? Math.round(answers.reduce((sum, answer) => sum + answer.latency, 0) / answers.length) : 0,
        difficulty: normalizeDifficultyLevel(difficulty, cap || 'Level 1'),
        details: { answers, level, kind },
      }),
    ).then(() => setSaved(true))
  }, [answers, config, done, kind, level, patientId, saved])

  const correctCount = answers.filter((answer) => answer.correct).length
  const image = itemImage(normalizedItem)

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t(config.titleKey)}</h1>
      {!items.length ? (
        <section className="mt-5 rounded-3xl border border-line bg-paper p-6">
          <p className="text-lg text-muted">No saved content is available for this activity yet. Ask your caregiver or doctor to add questions.</p>
        </section>
      ) : null}
      {items.length ? (
        <>
      <p className="mt-2 text-lg text-muted">{normalizedItem.question || t(config.promptKey)}</p>
      <p className="mt-2 text-base font-extrabold text-blue-dark">{t('difficultyLabel')}: {t(level.toLowerCase().replace(' ', ''))}</p>
      {!done ? (
        <>
          <div className="mt-5 rounded-3xl border border-line bg-paper p-8 text-center">
            {image ? (
              <img src={image} alt={normalizedItem.name || 'Recognition item'} className="mx-auto max-h-64 w-full rounded-2xl object-contain shadow-sm" />
            ) : (
              <div className="text-8xl" aria-hidden="true">{normalizedItem.emoji || '🧩'}</div>
            )}
            <p className="mt-4 text-2xl font-extrabold">{normalizedItem.question || t(config.promptKey)}</p>
            <p className="mt-2 text-lg text-muted">{t('questionOf', { n: question + 1, total: sessionQuestionCount })}</p>
          </div>
          <div className="mt-5 grid gap-3">
            {choices.map((choice, index) => (
              <button
                key={`${choice}-${index}`}
                type="button"
                disabled={Boolean(selected)}
                onClick={() => choose(choice)}
                className={`min-h-16 rounded-2xl border-2 px-4 text-xl font-extrabold ${
                  selected === choice ? (choice === normalizedItem.correctAnswer ? 'border-green bg-green/15' : 'border-orange bg-orange/15') : 'border-line bg-paper'
                }`}
              >
                {choice}
              </button>
            ))}
            {feedback ? (
              <>
                <p className={`mt-3 text-lg font-extrabold ${answers[answers.length - 1]?.correct ? 'text-green-dark' : 'text-orange-dark'}`}>
                  {feedback}
                </p>
                <button type="button" onClick={nextQuestion} className="mt-3 min-h-16 rounded-2xl bg-blue text-xl font-extrabold text-white">
                  {question + 1 >= sessionQuestionCount ? t('finishSession') : t('nextQuestion')}
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <section className="mt-6 rounded-3xl border-2 border-green bg-paper p-7 text-center">
          <p className="text-3xl font-extrabold text-green-dark">{t('wellDone')}</p>
          <p className="mt-3 text-2xl font-bold">{correctCount} / {answers.length}</p>
          <p className="mt-2 text-lg font-semibold text-muted">{t('accuracy')}: {answers.length ? Math.round((correctCount / answers.length) * 100) : 0}%</p>
          <p className="mt-2 text-lg font-semibold text-muted">{t('averageReaction')}: {answers.length ? Math.round(answers.reduce((sum, answer) => sum + answer.latency, 0) / answers.length) : 0} ms</p>
          <p className="mt-2 text-lg font-semibold text-muted">{t('difficultyLabel')}: {t(level.toLowerCase().replace(' ', ''))} · {t('completed')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={playAgain} className="min-h-14 rounded-2xl bg-blue text-xl font-extrabold text-white">{t('playAgain')}</button>
            <button type="button" onClick={() => navigate('/patient')} className="min-h-14 rounded-2xl bg-green text-xl font-extrabold text-white">{t('backDashboard')}</button>
          </div>
          {saved ? <p className="mt-3 text-base font-bold text-muted">{t('savedOnDevice')}</p> : null}
        </section>
      )}
        </>
      ) : null}
    </div>
  )
}
