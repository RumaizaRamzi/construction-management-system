import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Wrench,
  Wallet,
} from 'lucide-react'
import StatCard from '../ui/StatCard'
import { formatCurrency } from '../../utils/helpers'

export default function MaintenanceSummary({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <StatCard
        title="Equipment Under Maintenance"
        value={stats.underMaintenance}
        icon={Wrench}
        tone="violet"
      />
      <StatCard
        title="Scheduled Maintenance"
        value={stats.scheduled}
        icon={CalendarClock}
        tone="blue"
      />
      <StatCard
        title="Overdue Maintenance"
        value={stats.overdue}
        icon={AlertTriangle}
        tone="red"
      />
      <StatCard
        title="Maintenance Cost"
        value={formatCurrency(stats.maintenanceCost)}
        icon={Wallet}
        tone="brand"
      />
      <StatCard
        title="Completed This Month"
        value={stats.completedThisMonth}
        icon={CheckCircle2}
        tone="green"
      />
    </div>
  )
}
