import { cn } from '../../utils/helpers'

const variants = {
  Unread: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800',
  Read: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Snoozed: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Paused: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

export default function ReminderBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[status] || variants.Unread,
        className
      )}
    >
      {status || 'Unread'}
    </span>
  )
}
