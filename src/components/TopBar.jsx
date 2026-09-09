import { useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import { rolePath } from '../db/repo'

export default function TopBar({ backTo, backLabel, showHome = true, showExit = false }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { t } = useI18n()

  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <div>
          <p className="text-lg font-extrabold leading-tight text-ink">YaadSaathi</p>
          <p className="font-devanagari text-sm font-bold text-muted">यादसाथी</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {backTo ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="min-h-12 min-w-12 rounded-xl border-2 border-line bg-paper px-4 text-lg font-bold text-ink"
          >
            {backLabel || t('back')}
          </button>
        ) : null}
        {showHome ? (
          <button
            type="button"
            onClick={() => navigate(user ? rolePath(user.role) : '/role')}
            className="min-h-12 min-w-12 rounded-xl bg-blue px-4 text-lg font-bold text-white"
          >
            {t('home')}
          </button>
        ) : null}
        {showExit ? (
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
            className="min-h-12 rounded-xl border-2 border-line bg-paper px-4 text-lg font-bold text-ink"
          >
            {t('logout')}
          </button>
        ) : null}
      </div>
    </header>
  )
}
