import { formatCurrency } from '../../utils/helpers'

export default function AmountSummaryCards({
  total = 0,
  paid = 0,
  remaining = 0,
  totalLabel = 'Total Amount',
  paidLabel = 'Paid',
  remainingLabel = 'Remaining',
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 print:hidden">
      <div className="card p-5 border-l-4 border-l-slate-400">
        <p className="text-sm text-slate-500">{totalLabel}</p>
        <p className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
          {formatCurrency(total)}
        </p>
      </div>
      <div className="card p-5 border-l-4 border-l-emerald-500">
        <p className="text-sm text-slate-500">{paidLabel}</p>
        <p className="mt-2 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(paid)}
        </p>
      </div>
      <div className="card p-5 border-l-4 border-l-amber-500">
        <p className="text-sm text-slate-500">{remainingLabel}</p>
        <p className="mt-2 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
          {formatCurrency(remaining)}
        </p>
      </div>
    </div>
  )
}
