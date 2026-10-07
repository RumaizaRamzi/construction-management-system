import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ApiErrorState({
  title = 'Unable to load data',
  message = 'Please try again.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40">
        <AlertCircle size={22} aria-hidden />
      </div>
      <div>
        <p className="font-display font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      </div>
      {typeof onRetry === 'function' ? (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  )
}
