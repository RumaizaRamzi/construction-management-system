import {
  Banknote,
  CalendarDays,
  Clock,
  Settings2,
  TrendingDown,
  Wrench,
} from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'
import { getExpenseStats } from '../../utils/expenseHelpers'

export default function ExpenseStats({ expenses = [] }) {
  const stats = getExpenseStats(expenses)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard title="Total Expenses" value={formatCurrency(stats.total)} icon={TrendingDown} tone="red" />
      <StatCard
        title="Today's Expenses"
        value={formatCurrency(stats.todayExpenses)}
        icon={CalendarDays}
        tone="blue"
      />
      <StatCard
        title="This Month"
        value={formatCurrency(stats.monthExpenses)}
        icon={Banknote}
        tone="brand"
      />
      <StatCard
        title="Equipment Expenses"
        value={formatCurrency(stats.equipmentExpenses)}
        icon={Wrench}
        tone="violet"
      />
      <StatCard
        title="Operating Expenses"
        value={formatCurrency(stats.operatingExpenses)}
        icon={Settings2}
        tone="green"
      />
      <StatCard
        title="Pending Expenses"
        value={formatCurrency(stats.pendingExpenses)}
        icon={Clock}
        tone="red"
      />
    </div>
  )
}
