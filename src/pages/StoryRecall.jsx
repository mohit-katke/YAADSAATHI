import { useState } from 'react'
import TopBar from '../components/TopBar'
import { addTelemetry, enqueueSync, getLinkedPatient, saveActivitySession } from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

export default function StoryRecall() {
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const patient = await getLinkedPatient(user)
    const userId = patient?.id || user.id
    await addTelemetry({
      userId,
      kind: 'story_recall',
      data: { a1, a2 },
    })
    await enqueueSync({ kind: 'story_recall', payload: { a1, a2, userId } })
    const accuracy = Number(Boolean(a1.trim())) * 50 + Number(Boolean(a2.trim())) * 50
    await saveActivitySession({
      userId,
      gameType: 'story-recall',
      game: 'Story Recall',
      score: accuracy,
      accuracy,
      reactionLatency: 0,
      difficulty: 'Easy',
      details: { a1, a2 },
    })
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('storyRecall')}</h1>
      <p className="mt-2 text-lg text-muted">{t('storyHint')}</p>
      <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
        <h2 className="text-xl font-extrabold">{t('storyTitle')}</h2>
        <p className="mt-3 text-xl leading-relaxed">{t('storyBody')}</p>
        <button
          type="button"
          onClick={() => voiceEngine.speak(tVoice('storyBody'), voiceLang)}
          className="mt-4 min-h-14 rounded-2xl bg-blue px-5 text-lg font-extrabold text-white"
        >
          {t('voiceAssist')}
        </button>
      </section>
      <form onSubmit={submit} className="mt-5 space-y-4 rounded-3xl border border-line bg-paper p-5">
        <label className="block text-lg font-bold">
          {t('recallQ1')}
          <input
            value={a1}
            onChange={(e) => setA1(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
        </label>
        <label className="block text-lg font-bold">
          {t('recallQ2')}
          <input
            value={a2}
            onChange={(e) => setA2(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
          />
        </label>
        <button type="submit" className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white">
          {t('checkAnswers')}
        </button>
        {saved ? <p className="font-bold text-green-dark">{t('storySaved')}</p> : null}
      </form>
    </div>
  )
}
