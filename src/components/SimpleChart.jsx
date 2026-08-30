export function BarChart({ data, label }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div>
      <p className="mb-3 text-lg font-extrabold text-ink">{label}</p>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end justify-center">
              <div
                className="w-full max-w-10 rounded-t-lg bg-green"
                style={{ height: `${(d.value / max) * 100}%` }}
                title={`${d.day}: ${d.value}`}
              />
            </div>
            <span className="text-sm font-bold text-muted">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineChart({ data, label, unit = 'ms' }) {
  const width = 320
  const height = 140
  const pad = 16
  const values = data.map((d) => d.ms)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = data.map((d, i) => {
    const x = pad + (i * (width - pad * 2)) / (data.length - 1)
    const y = height - pad - ((d.ms - min) / span) * (height - pad * 2)
    return `${x},${y}`
  })

  return (
    <div>
      <p className="mb-3 text-lg font-extrabold text-ink">{label}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={label}>
        <polyline
          fill="none"
          stroke="#2B6CB0"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
        />
        {data.map((d, i) => {
          const x = pad + (i * (width - pad * 2)) / (data.length - 1)
          const y = height - pad - ((d.ms - min) / span) * (height - pad * 2)
          return <circle key={d.day} cx={x} cy={y} r="5" fill="#E06A2C" />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-sm font-bold text-muted">
        {data.map((d) => (
          <span key={d.day}>{d.day}</span>
        ))}
      </div>
      <p className="mt-2 text-base font-semibold text-muted">
        Latest: {data[data.length - 1].ms} {unit}
      </p>
    </div>
  )
}
