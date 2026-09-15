import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import PasswordField from '../components/PasswordField'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { LANGS } from '../i18n/strings'

const TOTAL = 5

const empty = {
  fullName: '',
  age: '',
  mobile: '',
  email: '',
  location: '',
  role: '',
  relationship: '',
  specialization: '',
  caregiverId: '',
  textLang: 'en',
  voiceLang: 'as',
  password: '',
  confirm: '',
}

export default function CreateAccount() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { t } = useI18n()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function validateStep() {
    if (step === 1) {
      if (form.fullName.trim().length < 2) return t('errName')
      const age = Number(form.age)
      if (!age || age < 1 || age > 120) return t('errAge')
      if (form.mobile.replace(/\D/g, '').length < 10) return t('errMobile')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return t('errEmail')
      if (form.location.trim().length < 2) return t('errLocation')
    }
    if (step === 2 && !form.role) return t('errRole')
    if (step === 3) {
      if (form.role === 'caregiver' && form.relationship.trim().length < 2) return t('errName')
      if (form.role === 'doctor' && form.specialization.trim().length < 2) return t('errName')
      if (form.role === 'patient' && form.caregiverId.trim().length < 1) return 'Caregiver ID is required. Enter the ID provided by your caregiver.'
    }
    if (step === 5) {
      if (form.password.length < 8) return t('errPasswordLen')
      if (form.password !== form.confirm) return t('errPasswordMatch')
    }
    return ''
  }

  async function next(event) {
    event.preventDefault()
    const message = validateStep()
    if (message) {
      setError(message)
      return
    }
    if (step < TOTAL) {
      setStep((n) => n + 1)
      return
    }
    setBusy(true)
    try {
      const result = await register(form)
      navigate(result.path)
    } catch (err) {
      setError(err?.code === 'caregiver-not-found'
        ? 'Caregiver ID not found. Please check the ID and try again.'
        : t('errDuplicate'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8 pb-28">
      <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-3 text-3xl font-extrabold text-ink">{t('createTitle')}</h1>
          <p className="mt-2 text-lg font-bold text-muted">{t('stepOf', { n: step, total: TOTAL })}</p>
        </div>

        <form onSubmit={next} className="space-y-4">
          {step === 1 ? (
            <>
              <Field label={t('fullName')} value={form.fullName} onChange={(v) => setField('fullName', v)} />
              <Field label={t('age')} value={form.age} onChange={(v) => setField('age', v.replace(/\D/g, ''))} inputMode="numeric" />
              <Field label={t('mobile')} value={form.mobile} onChange={(v) => setField('mobile', v.replace(/\D/g, '').slice(0, 10))} inputMode="tel" />
              <Field label={t('email')} value={form.email} onChange={(v) => setField('email', v)} />
              <Field label={t('location')} value={form.location} onChange={(v) => setField('location', v)} placeholder="Guwahati, Assam" />
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3">
              {['patient', 'caregiver', 'doctor'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setField('role', role)}
                  className={`min-h-16 rounded-2xl text-xl font-extrabold ${
                    form.role === role ? 'bg-orange text-white' : 'border-2 border-line bg-cream'
                  }`}
                >
                  {t(role)}
                </button>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <>
              {form.role === 'caregiver' ? (
                <Field label={t('relationship')} value={form.relationship} onChange={(v) => setField('relationship', v)} placeholder="Daughter" />
              ) : null}
              {form.role === 'doctor' ? (
                <Field label={t('specialization')} value={form.specialization} onChange={(v) => setField('specialization', v)} placeholder="Geriatric care" />
              ) : null}
              {form.role === 'patient' ? (
                <>
                  <p className="text-lg font-semibold text-muted">Enter the ID provided by your caregiver.</p>
                  <Field label="Caregiver ID" value={form.caregiverId} onChange={(v) => setField('caregiverId', v)} placeholder="user_..." />
                </>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <p className="text-lg font-bold">{t('textLanguage')}</p>
              <LangPicks value={form.textLang} onChange={(v) => setField('textLang', v)} />
              <p className="pt-2 text-lg font-bold">{t('voiceLanguage')}</p>
              <LangPicks value={form.voiceLang} onChange={(v) => setField('voiceLang', v)} />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <PasswordField
                id="new-password"
                label={t('password')}
                value={form.password}
                onChange={(v) => setField('password', v)}
                autoComplete="new-password"
                showLabel={t('showPassword')}
                hideLabel={t('hidePassword')}
              />
              <PasswordField
                id="confirm-password"
                label={t('confirmPassword')}
                value={form.confirm}
                onChange={(v) => setField('confirm', v)}
                autoComplete="new-password"
                showLabel={t('showPassword')}
                hideLabel={t('hidePassword')}
              />
            </>
          ) : null}

          {error ? <p className="font-bold text-orange-dark">{error}</p> : null}

          <button type="submit" disabled={busy} className="min-h-14 w-full rounded-2xl bg-green text-xl font-extrabold text-white disabled:opacity-70">
            {step === TOTAL ? t('saveContinue') : t('next')}
          </button>
          <button
            type="button"
            onClick={() => (step === 1 ? navigate('/') : setStep((n) => n - 1))}
            className="min-h-14 w-full rounded-2xl border-2 border-line bg-paper text-xl font-extrabold"
          >
            {t('back')}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, inputMode }) {
  return (
    <label className="block">
      <span className="text-lg font-bold">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl"
      />
    </label>
  )
}

function LangPicks({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LANGS.map((lang) => (
        <button
          key={lang.id}
          type="button"
          onClick={() => onChange(lang.id)}
          className={`min-h-14 rounded-2xl text-base font-extrabold ${
            value === lang.id ? 'bg-blue text-white' : 'border-2 border-line bg-cream'
          }`}
        >
          {lang.native}
        </button>
      ))}
    </div>
  )
}
