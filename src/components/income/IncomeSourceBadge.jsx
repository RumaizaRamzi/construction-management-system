import { cn } from '../../utils/helpers'

const variants = {
  Sale: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Rental: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  Booking: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  Other: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

export default function IncomeSourceBadge({ source, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[source] || variants.Other,
        className
      )}
    >
      {source || 'Other'}
    </span>
  )
}
