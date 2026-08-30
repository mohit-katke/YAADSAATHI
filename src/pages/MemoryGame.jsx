import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { LEVEL_ORDER, pairsForDifficulty } from '../data/mock'
import {
  getCurrentDifficulty,
  getDifficultyCap,
  getLinkedPatient,
  saveCompletedGame,
  saveCurrentDifficulty,
} from '../db/repo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'
import { LANGS } from '../i18n/strings'

function shuffle(list) {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function makeDeck(level) {
  const pairs = pairsForDifficulty(level)
  const doubled = pairs.flatMap((pair) => [
    { uid: `${pair.pairId}-a`, pairId: pair.pairId, emoji: pair.emoji, label: pair.label },
    { uid: `${pair.pairId}-b`, pairId: pair.pairId, emoji: pair.emoji, label: pair.label },
  ])
  return { deck: shuffle(doubled), pairCount: pairs.length }
}

function adapt(current, accuracy, cap) {
  const capIdx = LEVEL_ORDER.indexOf(cap)
  let idx = LEVEL_ORDER.indexOf(current)
  if (idx < 0) idx = 1
  if (accuracy >= 80 && idx < capIdx) idx += 1
  else if (accuracy < 50 && idx > 0) idx -= 1
  return LEVEL_ORDER[Math.min(idx, capIdx)]
}

export default function MemoryGame() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, tVoice, voiceLang } = useI18n()
  const [patientId, setPatientId] = useState(user?.id)
  const [difficulty, setDifficulty] = useState('Medium')
  const [cap, setCap] = useState('Medium')
  const [deck, setDeck] = useState([])
  const [pairCount, setPairCount] = useState(3)
  const [open, setOpen] = useState([])
  const [matched, setMatched] = useState([])
  const [locked, setLocked] = useState(false)
  const [tries, setTries] = useState(0)
  const [latencies, setLatencies] = useState([])
  const [saved, setSaved] = useState(false)
  const [voiceNote, setVoiceNote] = useState('')
  const flipStarted = useRef(0)
  const savedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const patient = await getLinkedPatient(user)
      const userId = patient?.id || user.id
      const [current, capLevel] = await Promise.all([getCurrentDifficulty(userId), getDifficultyCap(userId)])
      if (cancelled) return
      setPatientId(userId)
      setDifficulty(current)
      setCap(capLevel)
      const made = makeDeck(current)
      setDeck(made.deck)
      setPairCount(made.pairCount)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    const result = voiceEngine.speak(tVoice('voiceGame'), voiceLang)
    if (result.fallback) {
      const used = LANGS.find((l) => l.id === result.used)?.native || result.used
      setVoiceNote(t('voiceUnavailable', { lang: used }))
    } else {
      setVoiceNote('')
    }
  }, [t, tVoice, voiceLang])

  const complete = pairCount > 0 && matched.length === pairCount
  const score = useMemo(() => matched.length * 10, [matched.length])
  const avgMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

  useEffect(() => {
    if (!complete || savedRef.current || !patientId) return
    savedRef.current = true
    setSaved(true)
    const accuracy = tries ? Math.round((matched.length / tries) * 100) : 0
    const nextLevel = adapt(difficulty, accuracy, cap)
    saveCompletedGame({
      userId: patientId,
      score: matched.length * 10,
      matches: matched.length,
      tries,
      avgReactionMs: avgMs,
      difficulty,
      pairCount,
    }).then(() => saveCurrentDifficulty(patientId, nextLevel))
  }, [avgMs, cap, complete, difficulty, matched.length, pairCount, patientId, tries])

  function flip(card) {
    if (locked || complete || open.includes(card.uid) || matched.includes(card.pairId)) return
    if (open.length === 0) flipStarted.current = Date.now()
    const nextOpen = [...open, card.uid]
    setOpen(nextOpen)
    if (nextOpen.length < 2) return

    setTries((n) => n + 1)
    setLatencies((prev) => [...prev, Date.now() - flipStarted.current])
    const [firstId, secondId] = nextOpen
    const first = deck.find((c) => c.uid === firstId)
    const second = deck.find((c) => c.uid === secondId)
    if (first.pairId === second.pairId) {
      setMatched((prev) => [...prev, first.pairId])
      setOpen([])
    } else {
      setLocked(true)
      setTimeout(() => {
        setOpen([])
        setLocked(false)
      }, 800)
    }
  }

  function restart() {
    const made = makeDeck(difficulty)
    setDeck(made.deck)
    setPairCount(made.pairCount)
    setOpen([])
    setMatched([])
    setLocked(false)
    setTries(0)
    setLatencies([])
    setSaved(false)
    savedRef.current = false
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar backTo="/patient" backLabel={t('dashboard')} />
      <h1 className="text-3xl font-extrabold">{t('memoryMatch')}</h1>
      <p className="mt-1 text-lg text-muted">{t('gameIntro')}</p>
      <p className="mt-2 text-base font-bold text-blue-dark">
        {t('difficulty')}: {difficulty} · {t('currentCap')}: {cap}
      </p>
      {voiceNote ? <p className="mt-2 text-base font-bold text-orange-dark">{voiceNote}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3 text-lg font-extrabold">
        <span className="rounded-xl bg-paper px-4 py-2">
          {t('matches')}: {matched.length}/{pairCount || 0}
        </span>
        <span className="rounded-xl bg-paper px-4 py-2">
          {t('score')}: {score}
        </span>
        <span className="rounded-xl bg-paper px-4 py-2">
          {t('tries')}: {tries}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        {deck.map((card) => {
          const isOpen = open.includes(card.uid) || matched.includes(card.pairId)
          return (
            <button
              key={card.uid}
              type="button"
              aria-label={isOpen ? card.label : 'Hidden card'}
              onClick={() => flip(card)}
              className={`flex aspect-square min-h-[88px] items-center justify-center rounded-3xl border-4 text-5xl sm:text-6xl ${
                matched.includes(card.pairId)
                  ? 'border-green bg-green/15'
                  : isOpen
                    ? 'border-orange bg-paper'
                    : 'border-blue bg-blue text-white'
              }`}
            >
              {isOpen ? card.emoji : '?'}
            </button>
          )
        })}
      </div>

      {complete ? (
        <div className="mt-6 rounded-3xl border-2 border-green bg-paper p-5 text-center">
          <p className="text-2xl font-extrabold text-green-dark">{t('wellDone')}</p>
          <p className="mt-2 text-xl">{t('youMatched', { score })}</p>
          <p className="mt-2 text-lg font-bold text-muted">
            {t('accuracy')}: {tries ? Math.round((matched.length / tries) * 100) : 0}% · {t('reaction')}: {avgMs} ms
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={restart} className="min-h-14 rounded-2xl bg-orange text-xl font-extrabold text-white">
          {t('playAgain')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/patient')}
          className="min-h-14 rounded-2xl border-2 border-line bg-paper text-xl font-extrabold"
        >
          {t('backDashboard')}
        </button>
      </div>
    </div>
  )
}
