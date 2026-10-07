import {
  AlertTriangle,
  CalendarDays,
  Package,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'
import { getRentalStats } from '../../utils/rentalHelpers'

export default function RentalStats({ rentals = [], products = [] }) {
  const stats = getRentalStats(rentals, products)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Total Rentals"
        value={stats.totalRentals}
        icon={Receipt}
        tone="brand"
        trend="All contracts"
      />
      <StatCard
        title="Active Rentals"
        value={stats.activeRentals}
        icon={Package}
        tone="green"
        trend="In progress"
      />
      <StatCard
        title="Overdue"
        value={stats.overdueRentals}
        icon={AlertTriangle}
        tone="red"
        trend="Needs attention"
      />
      <StatCard
        title="This Month"
        value={formatCurrency(stats.monthIncome)}
        icon={TrendingUp}
        tone="violet"
        trend="Rental income"
      />
      <StatCard
        title="Pending Payments"
        value={formatCurrency(stats.pendingPayments)}
        icon={Wallet}
        tone="amber"
        trend={`${formatCurrency(stats.outstanding)} outstanding`}
      />
      <StatCard
        title="Available Units"
        value={stats.availableForRental}
        icon={CalendarDays}
        tone="blue"
        trend="Ready to rent"
      />
    </div>
  )
}
