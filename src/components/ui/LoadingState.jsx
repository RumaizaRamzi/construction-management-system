export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" aria-hidden />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
