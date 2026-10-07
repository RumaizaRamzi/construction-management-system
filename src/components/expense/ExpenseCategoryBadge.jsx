import { cn } from '../../utils/helpers'

const variants = {
  'Equipment Purchase':
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  'Equipment Repair':
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  Maintenance:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  Fuel: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Transportation:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  Salaries:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Utilities:
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  'Office Expenses':
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'Supplier Payment':
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'Rental Expense':
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  'Construction Materials':
    'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
  'Other Expense':
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

export default function ExpenseCategoryBadge({ category, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[category] || variants['Other Expense'],
        className
      )}
    >
      {category || 'Other Expense'}
    </span>
  )
}
