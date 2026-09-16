import { useEffect, useMemo, useState } from 'react'
import { analyzeGamePerformance, buildGameMetrics } from '../ai/analysis'

export default function AIInsight({ sessions, title = 'AI Performance Insight' }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const metrics = useMemo(() => buildGameMetrics(sessions), [sessions])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setResult(null)
    analyzeGamePerformance(metrics)
      .then((value) => { if (!cancelled) setResult(value) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [metrics])

  return (
    <section className="mt-5 rounded-3xl border border-line bg-paper p-5">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted">AI-generated game performance insight</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">Sessions</p>
          <p className="text-2xl font-extrabold">{metrics.totalSessions}</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">Accuracy</p>
          <p className="text-2xl font-extrabold">{metrics.averageAccuracy}%</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">Recent</p>
          <p className="text-2xl font-extrabold">{metrics.recentAverageAccuracy}%</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">Response</p>
          <p className="text-2xl font-extrabold">{metrics.averageResponseTime} ms</p>
        </div>
      </div>
      {loading ? <p className="mt-3 text-muted">Analyzing your recent game performance...</p> : null}
      {!loading && !result?.available ? (
        <div className="mt-3 rounded-2xl bg-cream p-4">
          <p className="font-semibold text-muted">
            {metrics.totalSessions
              ? 'AI analysis is temporarily unavailable. The performance statistics above are calculated from saved activity.'
              : 'Complete an activity to generate an AI performance insight. Your performance statistics will appear above.'}
          </p>
        </div>
      ) : null}
      {result?.available ? (
        <div className="mt-3 space-y-3 text-lg">
          <p>{result.summary}</p>
          <div><strong>Strengths:</strong> {result.strengths.join(', ') || 'No clear pattern yet.'}</div>
          <div><strong>Areas to practice:</strong> {result.areasToPractice.join(', ') || 'Continue practicing at your own pace.'}</div>
          <div><strong>Suggested next activity:</strong> {result.suggestedActivity || 'Continue with a familiar activity.'}</div>
        </div>
      ) : null}
    </section>
  )
}
