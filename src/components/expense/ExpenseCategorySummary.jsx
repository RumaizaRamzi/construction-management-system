import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import ChartCard from '../ui/ChartCard'
import { formatCurrency } from '../../utils/helpers'
import { expensesByCategoryChart, getCategorySummary } from '../../utils/expenseHelpers'

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#64748b', '#f97316']

export default function ExpenseCategorySummary({ expenses = [] }) {
  const rows = getCategorySummary(expenses)
  const chartData = expensesByCategoryChart(expenses)

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
          Expense Category Summary
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No expense data to summarize.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.category}>
                    <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.category}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatCurrency(row.amount)}</td>
                    <td className="py-2 text-slate-500">{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChartCard title="Expenses by Category" subtitle="Distribution across expense categories">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              label={(e) => `${e.name}`}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
