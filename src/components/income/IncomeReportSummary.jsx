import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import ChartCard from '../ui/ChartCard'
import { formatCurrency } from '../../utils/helpers'
import { getIncomeStats, incomeBySourceChart } from '../../utils/incomeHelpers'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']

export default function IncomeReportSummary({ income = [] }) {
  const stats = getIncomeStats(income)
  const chartData = incomeBySourceChart(income)

  const rows = [
    { label: 'Total Income', value: stats.total },
    { label: 'Sales Income', value: stats.salesIncome },
    { label: 'Rental Income', value: stats.rentalIncome },
    { label: 'Booking Income', value: stats.bookingIncome },
    { label: 'Other Income', value: stats.otherIncome },
    { label: 'Paid Income', value: stats.paidIncome },
    { label: 'Pending Income', value: stats.pendingIncome },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
          Income Report Summary
        </h3>
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

      <ChartCard title="Income by Source" subtitle="Distribution across income sources">
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
