import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export default function OfflineBanner() {
  const { t } = useI18n()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <div className="space-y-2" role="status">
      <div className="flex items-center justify-center rounded-xl border border-green/30 bg-green/10 px-4 py-2 text-base font-bold text-green-dark">
        {t('coreOffline')}
      </div>
      <div
        className={`rounded-xl border px-4 py-3 text-center ${
          online
            ? 'border-green/30 bg-green/10 text-green-dark'
            : 'border-orange/40 bg-orange/10 text-orange-dark'
        }`}
      >
        <p className="text-lg font-extrabold">{online ? t('onlineTitle') : t('offlineTitle')}</p>
        <p className="text-base font-semibold">{online ? t('onlineBody') : t('offlineBody')}</p>
      </div>
    </div>
  )
}
