import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { app, firebaseConfigured } from '../firebase/client'

const EMPTY_RESULT = {
  available: false,
  summary: '',
  strengths: [],
  areasToPractice: [],
  suggestedActivity: '',
  reason: 'AI analysis unavailable',
}

const AI_MODEL = 'gemini-3.6-flash'

export function buildGameMetrics(sessions = []) {
  const rows = sessions.filter((session) => Number.isFinite(Number(session.accuracy)))
  const recent = rows.slice(0, 5)
  const previous = rows.slice(5, 10)
  const average = (items, key) => items.length
    ? Math.round(items.reduce((sum, row) => sum + Number(row[key] || 0), 0) / items.length)
    : 0
  const byDifficulty = {}
  let totalQuestions = 0
  let correctAnswers = 0
  for (const row of rows) {
    const key = row.difficulty || 'Unknown'
    byDifficulty[key] ||= { sessions: 0, accuracy: 0, responseTime: 0 }
    byDifficulty[key].sessions += 1
    byDifficulty[key].accuracy += Number(row.accuracy || 0)
    byDifficulty[key].responseTime += Number(row.avgReactionMs || 0)
    const details = Array.isArray(row.details) ? row.details : []
    totalQuestions += details.length
    correctAnswers += details.filter((item) => item?.isCorrect === true).length
  }
  Object.values(byDifficulty).forEach((value) => {
    value.accuracy = Math.round(value.accuracy / value.sessions)
    value.responseTime = Math.round(value.responseTime / value.sessions)
  })
  return {
    totalSessions: rows.length,
    completedGames: rows.filter((row) => row.completed !== false).length,
    averageAccuracy: average(rows, 'accuracy'),
    averageResponseTime: average(rows, 'avgReactionMs'),
    recentAverageAccuracy: average(recent, 'accuracy'),
    previousAverageAccuracy: average(previous, 'accuracy'),
    totalQuestions,
    correctAnswers,
    incorrectAnswers: Math.max(0, totalQuestions - correctAnswers),
    recentTrend: recent.map((row) => ({
      accuracy: Number(row.accuracy || 0),
      difficulty: row.difficulty || 'Unknown',
    })),
    byDifficulty,
  }
}

function responseText(result) {
  const response = result?.response || result
  if (typeof response?.text === 'function') return response.text()
  if (typeof response?.text === 'string') return response.text
  if (typeof result?.text === 'function') return result.text()
  if (typeof result?.text === 'string') return result.text
  return ''
}

function parseModelJson(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
    if (fenced) {
      try {
        return JSON.parse(fenced)
      } catch {
        return null
      }
    }
    const object = trimmed.match(/\{[\s\S]*\}/)?.[0]
    if (!object) return null
    try {
      return JSON.parse(object)
    } catch {
      return null
    }
  }
}

function sanitize(value) {
  if (!value || typeof value !== 'object') return null
  const summary = String(value.summary || '').trim()
  if (!summary) return null
  return {
    available: true,
    summary,
    strengths: Array.isArray(value.strengths) ? value.strengths.map(String).slice(0, 4) : [],
    areasToPractice: Array.isArray(value.areasToPractice) ? value.areasToPractice.map(String).slice(0, 4) : [],
    suggestedActivity: String(value.suggestedActivity || '').trim(),
  }
}

export async function analyzeGamePerformance(metrics) {
  if (!metrics?.totalSessions) return { ...EMPTY_RESULT, metrics, reason: 'no-activity' }
  if (!firebaseConfigured || !app || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { ...EMPTY_RESULT, metrics, reason: 'AI requires an online Firebase connection' }
  }
  try {
    const ai = getAI(app, { backend: new GoogleAIBackend() })
    const model = getGenerativeModel(ai, {
      model: AI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    })
    const prompt = `You are analyzing cognitive GAME PERFORMANCE data.
Do not diagnose dementia or any medical condition.
Do not determine disease progression.
Do not provide medical treatment or medical advice.
Describe only observable patterns in the supplied game-performance metrics.
Return JSON only with keys summary, strengths, areasToPractice, and suggestedActivity.
Metrics: ${JSON.stringify(metrics)}`
    const response = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('ai-timeout')), 15000)),
    ])
    const text = responseText(response)
    const result = sanitize(parseModelJson(text))
    if (result) return { ...result, metrics }
    if (text.trim()) {
      return {
        ...EMPTY_RESULT,
        available: true,
        summary: text.trim(),
        metrics,
        reason: 'Gemini returned non-JSON text',
      }
    }
    throw new Error('Gemini returned an empty response')
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[YaadSaathi AI] Gemini analysis failed:', error)
    }
    return { ...EMPTY_RESULT, metrics, reason: error?.message || 'AI analysis unavailable' }
  }
}
