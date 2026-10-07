import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  KeyRound,
  Scale,
  ShoppingCart,
} from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'

const money = (value) => (value == null ? 'Restricted' : formatCurrency(value))

export default function ReportSummaryCards({ summary }) {
  if (!summary) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Total Sales"
        value={formatCurrency(summary.totalSales)}
        icon={ShoppingCart}
        tone="green"
      />
      <StatCard
        title="Total Rental Income"
        value={formatCurrency(summary.totalRentalIncome)}
        icon={KeyRound}
        tone="blue"
      />
      <StatCard
        title="Total Income"
        value={money(summary.totalIncome)}
        icon={ArrowUpRight}
        tone="brand"
      />
      <StatCard
        title="Total Expenses"
        value={money(summary.totalExpenses)}
        icon={ArrowDownRight}
        tone="red"
      />
      <StatCard
        title="Net Cash Flow"
        value={money(summary.netCashFlow)}
        icon={Scale}
        tone={summary.netCashFlow == null || summary.netCashFlow >= 0 ? 'violet' : 'red'}
      />
      <StatCard
        title="Total Transactions"
        value={summary.totalTransactions}
        icon={CircleDollarSign}
        tone="slate"
      />
    </div>
  )
}
