import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import OfflineBanner from '../components/OfflineBanner'
import PasswordField from '../components/PasswordField'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { rolePath } from '../db/repo'

export default function Landing() {
  const navigate = useNavigate()
  const { login, user, ready } = useAuth()
  const { t } = useI18n()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={rolePath(user.role)} replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!identifier.trim()) {
      setError(t('loginError'))
      return
    }
    if (password.length < 8) {
      setError(t('loginError'))
      return
    }
    setBusy(true)
    try {
      const result = await login(identifier, password)
      if (!result.ok) {
        setError(t('loginError'))
        return
      }
      navigate(result.path)
    } catch {
      setError(t('loginError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8 pb-28">
      <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-4xl font-extrabold text-ink">YaadSaathi</h1>
          <p className="font-devanagari mt-1 text-3xl font-bold text-green">यादसाथी</p>
          <p className="mt-3 text-xl font-semibold text-muted">{t('tagline')}</p>
          <p className="mt-2 text-base text-muted">{t('pwaLine')}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-left text-xl font-extrabold">{t('loginTitle')}</h2>
          <label className="block text-left text-lg font-bold text-ink" htmlFor="identifier">
            {t('identifier')}
          </label>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value)
              setError('')
            }}
            placeholder="mina@yaadsaathi.app"
            className="min-h-14 w-full rounded-2xl border-2 border-line bg-cream px-4 text-xl text-ink"
          />
          <PasswordField
            id="password"
            label={t('password')}
            value={password}
            onChange={(v) => {
              setPassword(v)
              setError('')
            }}
            showLabel={t('showPassword')}
            hideLabel={t('hidePassword')}
          />
          {error ? <p className="text-base font-bold text-orange-dark">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="min-h-14 w-full rounded-2xl bg-orange text-xl font-extrabold text-white disabled:opacity-70"
          >
            {t('continue')}
          </button>
        </form>

        <Link
          to="/create-account"
          className="mt-4 flex min-h-14 items-center justify-center rounded-2xl border-2 border-green text-xl font-extrabold text-green-dark"
        >
          {t('createAccount')}
        </Link>

        <div className="mt-6">
          <OfflineBanner />
        </div>
      </div>
    </div>
  )
}
