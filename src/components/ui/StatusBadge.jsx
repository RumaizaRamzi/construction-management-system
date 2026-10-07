import { cn } from '../../utils/helpers'

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  primary: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800',
}

const statusMap = {
  Active: 'success',
  Confirmed: 'success',
  Completed: 'success',
  Returned: 'success',
  Paid: 'success',
  Success: 'success',
  Available: 'success',
  New: 'success',
  Read: 'neutral',
  Pending: 'warning',
  Partial: 'warning',
  Upcoming: 'warning',
  Scheduled: 'warning',
  Warning: 'warning',
  Fair: 'warning',
  'Low Stock': 'warning',
  Used: 'warning',
  'Due Today': 'warning',
  'In Progress': 'warning',
  Overdue: 'danger',
  Unpaid: 'danger',
  Cancelled: 'danger',
  Failed: 'danger',
  Critical: 'danger',
  Urgent: 'danger',
  Damaged: 'danger',
  'Out of Stock': 'danger',
  Dismissed: 'neutral',
  Refunded: 'neutral',
  Inactive: 'neutral',
  Info: 'info',
  Good: 'info',
  Excellent: 'success',
  Rented: 'info',
  Maintenance: 'primary',
  'Under Maintenance': 'primary',
  'Out of Service': 'danger',
  'Under Review': 'warning',
  Deposited: 'info',
  Cleared: 'success',
  Bounced: 'danger',
}

export default function StatusBadge({ status, className }) {
  const label = status ?? '—'
  const variant = statusMap[label] || 'neutral'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className
      )}
      title={String(label)}
    >
      {label}
    </span>
  )
}
