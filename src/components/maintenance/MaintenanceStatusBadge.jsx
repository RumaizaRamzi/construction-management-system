import { cn } from '../../utils/helpers'
import { isOverdueMaintenance } from '../../utils/maintenanceHelpers'

const variants = {
  Scheduled: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  'In Progress': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  'On Hold': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  Cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
}

export default function MaintenanceStatusBadge({ status, record, className }) {
  const overdue = record ? isOverdueMaintenance(record) : status === 'Overdue'
  const label = overdue && !['Completed', 'Cancelled'].includes(status) ? 'Overdue' : status
  const tone = overdue && !['Completed', 'Cancelled'].includes(status) ? 'Overdue' : status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[tone] || variants.Scheduled,
        className
      )}
    >
      {label || 'Scheduled'}
    </span>
  )
}
