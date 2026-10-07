import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

/**
 * Subtle offline banner + toast when connection returns.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const { info, warning } = useToast()

  useEffect(() => {
    const onOffline = () => {
      setOffline(true)
      warning("You're offline. Some features may not work until the connection is restored.")
    }
    const onOnline = () => {
      setOffline(false)
      info('Connection restored.')
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [info, warning])

  if (!offline) return null

  return (
    <div
      role="status"
      className="no-print fixed inset-x-0 top-0 z-[110] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-center text-sm font-medium text-white shadow"
    >
      <WifiOff size={16} aria-hidden />
      You&apos;re offline. Some features may not work until the connection is restored.
    </div>
  )
}
