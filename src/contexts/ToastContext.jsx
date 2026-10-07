import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const tones = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
}

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 3500)
  }, [removeToast])

  const value = useMemo(
    () => ({
      toast: pushToast,
      success: (msg) => pushToast(msg, 'success'),
      error: (msg) => pushToast(msg, 'error'),
      warning: (msg) => pushToast(msg, 'warning'),
      info: (msg) => pushToast(msg, 'info'),
    }),
    [pushToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${tones[t.type]}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              <button type="button" className="opacity-60 hover:opacity-100" onClick={() => removeToast(t.id)}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
