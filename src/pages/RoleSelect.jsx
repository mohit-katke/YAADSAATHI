import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import OfflineBanner from '../components/OfflineBanner'
import { useI18n } from '../i18n/I18nProvider'
import { voiceEngine } from '../voice/speech'

const ROLES = [
  { id: 'patient', path: '/patient', titleKey: 'patient', hintKey: 'patientHint', color: 'bg-orange' },
  { id: 'caregiver', path: '/caregiver', titleKey: 'caregiver', hintKey: 'caregiverHint', color: 'bg-green' },
  { id: 'doctor', path: '/doctor', titleKey: 'doctor', hintKey: 'doctorHint', color: 'bg-blue' },
]

export default function RoleSelect() {
  const navigate = useNavigate()
  const { t, tVoice, voiceLang } = useI18n()

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-28">
      <TopBar showHome={false} showExit backTo="/" backLabel={t('back')} />
      <h1 className="mb-2 text-center text-3xl font-extrabold text-ink sm:text-4xl">{t('whoAreYou')}</h1>
      <p className="mb-6 text-center text-lg text-muted">{t('tapRole')}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => {
              voiceEngine.speak(tVoice('voiceNav'), voiceLang)
              navigate(role.path)
            }}
            className={`${role.color} flex min-h-40 flex-col items-center justify-center rounded-3xl px-4 py-8 text-white shadow-sm`}
          >
            <span className="text-2xl font-extrabold sm:text-3xl">{t(role.titleKey)}</span>
            <span className="mt-3 text-center text-lg font-semibold text-white/95">{t(role.hintKey)}</span>
          </button>
        ))}
      </div>
      <div className="mt-8">
        <OfflineBanner />
      </div>
    </div>
  )
}
