import { Inbox } from 'lucide-react'

export default function EmptyState({
  title = 'No data found',
  description = 'Try adjusting your filters or add a new record.',
  action,
  icon: Icon = Inbox,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-800">
        <Icon size={20} aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
