import { formatCurrency } from '../../utils/helpers'
import { getFinancialOverview } from '../../utils/financialHelpers'

export default function FinancialSummary({
  income = [],
  expenses = [],
  incomePayments = [],
  expensePayments = [],
}) {
  const overview = getFinancialOverview(income, expenses, incomePayments, expensePayments)

  const rows = [
    { label: 'Total Income', value: overview.totalIncome },
    { label: 'Paid Income', value: overview.paidIncome },
    { label: 'Outstanding Income', value: overview.outstandingIncome },
    { label: 'Total Expenses', value: overview.totalExpenses },
    { label: 'Paid Expenses', value: overview.paidExpenses },
    { label: 'Outstanding Expenses', value: overview.outstandingExpenses },
  ]

  return (
    <div className="card p-5 print:hidden">
      <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
        Financial Summary
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Income (Paid)</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(overview.paidIncome)}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4">
          <p className="text-xs text-red-700 dark:text-red-300">Expenses (Paid)</p>
          <p className="mt-1 font-display text-xl font-bold text-red-700 dark:text-red-300">
            {formatCurrency(overview.paidExpenses)}
          </p>
        </div>
        <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-sky-700 dark:text-sky-300">Net Cash Flow</p>
          <p
            className={`mt-1 font-display text-xl font-bold ${
              overview.netCashFlow >= 0
                ? 'text-sky-700 dark:text-sky-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {formatCurrency(overview.netCashFlow)}
          </p>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2 last:border-0"
          >
            <span className="text-slate-500">{row.label}</span>
            <strong className="text-slate-900 dark:text-white">{formatCurrency(row.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
