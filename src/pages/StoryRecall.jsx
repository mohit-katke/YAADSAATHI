import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { normalizeDifficultyLevel, storyRecallPlan } from '../data/mock'
import { addTelemetry, enqueueSync, getCurrentDifficulty, getLinkedPatient, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function StoryRecall() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [level, setLevel] = useState('Level 1')
  const [answers, setAnswers] = useState([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const userId = patient?.id || user.id
      const current = normalizeDifficultyLevel(await getCurrentDifficulty(userId), 'Level 1')
      if (!cancelled) setLevel(current)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const plan = useMemo(() => storyRecallPlan(level), [level])
  const inputs = useMemo(() => plan.questions.map((question, index) => ({
    id: `story-${index}`,
    label: question,
    value: answers[index] || '',
  })), [answers, plan.questions])

  function updateAnswer(index, value) {
    setAnswers((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
  }

  function retry() {
    setAnswers([])
    setSaved(false)
  }

  async function submit(event) {
    event.preventDefault()
    const patient = await getLinkedPatient(user)
    const userId = patient?.id || user.id
    const filled = answers.filter((text) => String(text || '').trim().length > 0).length
    const accuracy = Math.round((filled / Math.max(plan.questions.length, 1)) * 100)

    await addTelemetry({
      userId,
      kind: 'story_recall',
      data: { level, answers },
    })
    await enqueueSync({ kind: 'story_recall', payload: { level, answers, userId } })
    await saveActivitySession({
      userId,
      gameType: 'story-recall',
      game: 'Story Recall',
      score: accuracy,
      accuracy,
      reactionLatency: 0,
      difficulty: level,
      details: { level, answers },
    })
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('storyRecall')}</h1>
      <p className="mt-2 text-lg text-muted">{t('storyHint')}</p>
      <p className="mt-2 text-base font-extrabold text-blue-dark">{t('difficultyLabel')}: {t(level.toLowerCase().replace(' ', ''))}</p>
      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('storyTitle')}</h2>
        <p className="mt-3 text-xl leading-relaxed">{plan.body}</p>
        <button
          type="button"
          onClick={() => voiceEngine.speak(tVoice('storyBody'), voiceLang)}
          className="mt-4 min-h-14 rounded-2xl bg-blue px-5 text-lg font-extrabold text-white"
        >
          {t('voiceAssist')}
        </button>
      </section>
      <form onSubmit={submit} className="mt-5 space-y-4 rounded-3xl border border-line bg-paper p-5">
        {inputs.map((input, index) => (
          <label key={input.id} className="block text-lg font-bold">
            {input.label}
            <input
              value={input.value}
              onChange={(e) => updateAnswer(index, e.target.value)}
              className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
            />
          </label>
        ))}
        <button type="submit" className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white">
          {t('checkAnswers')}
        </button>
        {saved ? (
          <>
            <p className="font-bold text-green-dark">{t('storySaved')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={retry} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">
                {t('playAgain')}
              </button>
              <button type="button" onClick={() => navigate('/patient')} className="min-h-14 rounded-2xl border-2 border-line text-xl font-extrabold">
                {t('backDashboard')}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  )
}
