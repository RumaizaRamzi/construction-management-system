import {
  KeyRound,
  Landmark,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { cn } from '../../utils/helpers'

const ICONS = {
  ShoppingCart,
  KeyRound,
  Package,
  Wallet,
  Users,
  Wrench,
  Landmark,
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
}

export default function ReportCategoryCard({ category, active = false, onView }) {
  const Icon = ICONS[category.icon] || Package
  const count = category.reports?.length || 0

  return (
    <div
      id={`report-category-${category.id}`}
      className={cn(
        'card p-5 flex flex-col h-full transition-shadow',
        active && 'ring-2 ring-brand-500/40'
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('rounded-xl p-3 shrink-0', TONES[category.tone] || TONES.slate)}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white">
            {category.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{category.description}</p>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 mb-4 flex-1">
        {category.reports.map((name) => (
          <li key={name} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
            {name}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{count}</span>{' '}
          available reports
        </p>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => onView?.(category)}
        >
          View Reports
        </button>
      </div>
    </div>
  )
}
