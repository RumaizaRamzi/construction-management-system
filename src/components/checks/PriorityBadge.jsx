import { cn } from '../../utils/helpers'

const variants = {
  Low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Medium: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  High: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
}

export default function PriorityBadge({ priority, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[priority] || variants.Medium,
        className
      )}
    >
      {priority || 'Medium'}
    </span>
  )
}
