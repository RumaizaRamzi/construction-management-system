import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard from '../ui/ChartCard'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'
import { RENTAL_STATUSES, getRentalStats } from '../../utils/rentalHelpers'
import { CreditCard, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'

const PIE_COLORS = ['#c8211a', '#0ea5e9', '#10b981', '#d4a017', '#8b5cf6', '#64748b', '#ec4899']

export default function RentalIncomeSummary({ rentals = [], products = [] }) {
  const stats = getRentalStats(rentals, products)

  const monthlyIncome = useMemo(() => {
    const map = {}
    rentals
      .filter((r) => r.rentalStatus !== 'Cancelled')
      .forEach((r) => {
        const month = String(r.startDate).slice(0, 7)
        map[month] = (map[month] || 0) + Number(r.total || 0)
      })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        total,
      }))
  }, [rentals])

  const mostRented = useMemo(() => {
    const map = {}
    rentals
      .filter((r) => r.rentalStatus !== 'Cancelled')
      .forEach((r) => {
        const name = r.product || 'Unknown'
        map[name] = (map[name] || 0) + Number(r.quantity || 1)
      })
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [rentals])

  const activityByStatus = useMemo(() => {
    const map = Object.fromEntries(RENTAL_STATUSES.map((s) => [s, 0]))
    rentals.forEach((r) => {
      map[r.rentalStatus] = (map[r.rentalStatus] || 0) + 1
    })
    return Object.entries(map)
      .filter(([, value]) => value > 0)
      .map(([name, count]) => ({ name, count }))
  }, [rentals])

  const statusDistribution = useMemo(() => {
    const activeStatuses = ['Active', 'Confirmed', 'Overdue']
    const completed = rentals.filter((r) => r.rentalStatus === 'Returned').length
    const active = rentals.filter((r) => activeStatuses.includes(r.rentalStatus)).length
    const cancelled = rentals.filter((r) => r.rentalStatus === 'Cancelled').length
    const other = rentals.length - completed - active - cancelled
    return [
      { name: 'Active', value: active },
      { name: 'Returned', value: completed },
      { name: 'Cancelled', value: cancelled },
      { name: 'Other', value: other },
    ].filter((d) => d.value > 0)
  }, [rentals])

  const currencyTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium">{label}</p>
        <p className="text-brand-600">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.rentalRevenue)}
          icon={TrendingUp}
          tone="brand"
          trend="All time"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats.monthIncome)}
          icon={CreditCard}
          tone="green"
          trend="Current month"
        />
        <StatCard
          title="Deposits Held"
          value={formatCurrency(stats.depositsCollected)}
          icon={Wallet}
          tone="violet"
          trend="Collected"
        />
        <StatCard
          title="Late & Damage"
          value={formatCurrency(stats.lateFees + stats.damageCharges)}
          icon={AlertTriangle}
          tone="red"
          trend={`${formatCurrency(stats.lateFees)} late`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Monthly Income" subtitle="Rental revenue by month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyIncome}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={currencyTooltip} />
              <Bar dataKey="total" fill="#c8211a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most Rented Equipment" subtitle="Units rented by product">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mostRented} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rental Activity by Status" subtitle="Contract counts">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityByStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Distribution" subtitle="Active vs completed">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {statusDistribution.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
