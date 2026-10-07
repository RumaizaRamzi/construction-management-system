import {
  Banknote,
  CalendarDays,
  Clock,
  KeyRound,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'
import { getIncomeStats } from '../../utils/incomeHelpers'

export default function IncomeStats({ income = [] }) {
  const stats = getIncomeStats(income)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard title="Total Income" value={formatCurrency(stats.total)} icon={TrendingUp} tone="green" />
      <StatCard title="Today's Income" value={formatCurrency(stats.todayIncome)} icon={CalendarDays} tone="blue" />
      <StatCard title="This Month" value={formatCurrency(stats.monthIncome)} icon={Banknote} tone="brand" />
      <StatCard title="Rental Income" value={formatCurrency(stats.rentalIncome)} icon={KeyRound} tone="violet" />
      <StatCard title="Sales Income" value={formatCurrency(stats.salesIncome)} icon={ShoppingCart} tone="green" />
      <StatCard title="Pending Income" value={formatCurrency(stats.pendingIncome)} icon={Clock} tone="red" />
    </div>
  )
}
