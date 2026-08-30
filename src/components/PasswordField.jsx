import { useId, useState } from 'react'

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  showLabel,
  hideLabel,
}) {
  const [visible, setVisible] = useState(false)
  const generated = useId()
  const fieldId = id || generated

  return (
    <div>
      {label ? (
        <label className="block text-lg font-bold text-ink" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className="relative mt-1">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 pr-28 text-xl text-ink"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 min-h-12 -translate-y-1/2 rounded-xl bg-paper px-3 text-base font-extrabold text-blue-dark"
          aria-pressed={visible}
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </div>
  )
}
