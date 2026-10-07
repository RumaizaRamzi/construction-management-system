import { CalendarDays, Clock, CreditCard, Receipt, TrendingUp } from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'
import { getSaleStats } from '../../utils/saleHelpers'

export default function SalesStats({ sales }) {
  const stats = getSaleStats(sales)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard title="Total Sales" value={stats.totalSales} icon={Receipt} tone="brand" trend="Active invoices" />
      <StatCard title="Today's Sales" value={stats.todaySales} icon={CalendarDays} tone="blue" trend="Completed today" />
      <StatCard title="This Month's Sales" value={stats.monthSales} icon={TrendingUp} tone="green" trend="Current month" />
      <StatCard
        title="Total Sales Revenue"
        value={formatCurrency(stats.totalRevenue)}
        icon={CreditCard}
        tone="violet"
        trend="Excluding refunds"
      />
      <StatCard
        title="Pending Payments"
        value={stats.pendingPayments}
        icon={Clock}
        tone="red"
        trend={formatCurrency(stats.pendingAmount) + ' outstanding'}
      />
    </div>
  )
}
